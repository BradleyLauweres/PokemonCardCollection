import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/Navbar';
import SetBanner from './components/SetBanner';
import FilterBar from './components/FilterBar';
import CardGrid from './components/CardGrid';
import CardModal from './components/CardModal';
import StatsModal from './components/StatsModal';
import {
  fetchSets,
  fetchSetCards,
  fetchUserCollection,
  toggleCardOwnership,
  updateCardQuantity,
  updateCardPrice,
  bulkToggleSet,
  fetchCollectionStats
} from './api';

export default function App() {
  const [sets, setSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('sv3');
  const [setCards, setSetCards] = useState([]);
  const [userCollection, setUserCollection] = useState([]);
  const [stats, setStats] = useState(null);
  
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('number');
  
  // Modal states
  const [inspectedCard, setInspectedCard] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Load sets & initial user stats on mount
  useEffect(() => {
    async function init() {
      setIsLoadingSets(true);
      const fetchedSets = await fetchSets();
      setSets(fetchedSets);
      if (fetchedSets.length > 0) {
        const defaultSet = fetchedSets.find(s => s.id === 'sv3') || fetchedSets[0];
        setSelectedSetId(defaultSet.id);
      }
      setIsLoadingSets(false);
      
      const initialStats = await fetchCollectionStats();
      setStats(initialStats);
    }
    init();
  }, []);

  // Load cards and user collection when selectedSetId changes
  useEffect(() => {
    if (!selectedSetId) return;

    async function loadSetData() {
      setIsLoadingCards(true);

      if (selectedSetId === 'all_owned') {
        const allUserCards = await fetchUserCollection(); // Fetch all across all sets
        const formattedCards = allUserCards.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          images: { small: c.image_url || 'https://images.pokemontcg.io/sv3/1.png', large: c.image_url || 'https://images.pokemontcg.io/sv3/1.png' },
          set: { id: c.set_id, name: c.set_id }
        }));
        setSetCards(formattedCards);
        setUserCollection(allUserCards);
      } else {
        const [cardsData, userColData] = await Promise.all([
          fetchSetCards(selectedSetId),
          fetchUserCollection(selectedSetId)
        ]);
        setSetCards(cardsData);
        setUserCollection(userColData);
      }

      setIsLoadingCards(false);
    }
    loadSetData();
  }, [selectedSetId]);

  // Dictionary key: card_id -> cardData
  const userCollectionMap = useMemo(() => {
    return userCollection.reduce((acc, item) => {
      acc[item.card_id] = item;
      return acc;
    }, {});
  }, [userCollection]);

  // Current set object
  const currentSet = useMemo(() => {
    return sets.find(s => s.id === selectedSetId);
  }, [sets, selectedSetId]);

  // Current set value
  const currentSetValue = useMemo(() => {
    if (selectedSetId === 'all_owned') return stats?.total_market_value || 0;
    if (!stats?.set_values || !selectedSetId) return 0;
    return stats.set_values[selectedSetId] || 0;
  }, [stats, selectedSetId]);

  // Unique rarities for current set
  const setRarities = useMemo(() => {
    const raritiesSet = new Set();
    setCards.forEach(c => {
      if (c.rarity) raritiesSet.add(c.rarity);
    });
    return Array.from(raritiesSet).sort();
  }, [setCards]);

  // Toggle card ownership
  const handleToggleCard = async (card, marketPrice = 0) => {
    const isCurrentlyOwned = !!userCollectionMap[card.id];
    const cardSetId = card.set?.id || selectedSetId;

    if (isCurrentlyOwned) {
      setUserCollection(prev => prev.filter(c => c.card_id !== card.id));
      if (selectedSetId === 'all_owned') {
        setSetCards(prev => prev.filter(c => c.id !== card.id));
      }
    } else {
      const cmPrice = card.cardmarket?.prices?.averageSellPrice;
      const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
      const mPrice = marketPrice || cmPrice || tcgPrice || 0;

      const newCardEntry = {
        card_id: card.id,
        set_id: cardSetId,
        name: card.name,
        number: card.number,
        rarity: card.rarity || '',
        image_url: card.images?.small || '',
        market_price: mPrice,
        custom_price: 0,
        quantity: 1
      };
      setUserCollection(prev => [...prev, newCardEntry]);
    }

    try {
      const cmPrice = card.cardmarket?.prices?.averageSellPrice;
      const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
      const mPrice = marketPrice || cmPrice || tcgPrice || 0;

      await toggleCardOwnership({
        card_id: card.id,
        set_id: cardSetId,
        name: card.name,
        number: card.number,
        rarity: card.rarity || '',
        image_url: card.images?.small || '',
        market_price: mPrice
      });

      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to sync toggle with backend', err);
    }
  };

  // Save custom price & notes
  const handleSavePrice = async (cardId, customPrice, notes) => {
    setUserCollection(prev =>
      prev.map(c => c.card_id === cardId ? { ...c, custom_price: customPrice, notes } : c)
    );

    try {
      await updateCardPrice(cardId, customPrice, notes);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to save custom price', err);
    }
  };

  // Change quantity for owned card
  const handleQuantityChange = async (cardId, newQty) => {
    if (newQty <= 0) {
      setUserCollection(prev => prev.filter(c => c.card_id !== cardId));
      if (selectedSetId === 'all_owned') {
        setSetCards(prev => prev.filter(c => c.id !== cardId));
      }
    } else {
      setUserCollection(prev =>
        prev.map(c => c.card_id === cardId ? { ...c, quantity: newQty } : c)
      );
    }

    try {
      await updateCardQuantity(cardId, newQty);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to update quantity', err);
    }
  };

  // Bulk action: Mark All as Owned
  const handleMarkAllOwned = async () => {
    if (selectedSetId === 'all_owned') return;
    if (!window.confirm(`Are you sure you want to mark all ${setCards.length} cards in ${currentSet?.name} as owned?`)) {
      return;
    }

    const allEntries = setCards.map(c => ({
      card_id: c.id,
      set_id: selectedSetId,
      name: c.name,
      number: c.number,
      rarity: c.rarity || '',
      image_url: c.images?.small || '',
      quantity: 1
    }));
    setUserCollection(allEntries);

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 }
    });

    try {
      await bulkToggleSet(selectedSetId, 'mark_all', setCards);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed bulk mark all', err);
    }
  };

  // Bulk action: Clear Set
  const handleClearSet = async () => {
    if (selectedSetId === 'all_owned') return;
    if (!window.confirm(`Are you sure you want to clear all collected cards for ${currentSet?.name}?`)) {
      return;
    }

    setUserCollection([]);
    try {
      await bulkToggleSet(selectedSetId, 'clear_all');
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed clear set', err);
    }
  };

  // Filtered & Sorted Cards
  const filteredCards = useMemo(() => {
    return setCards
      .filter((card) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = card.name?.toLowerCase().includes(q);
          const numMatch = card.number?.toLowerCase().includes(q);
          const setMatch = card.set?.name?.toLowerCase().includes(q) || card.set?.id?.toLowerCase().includes(q);
          if (!nameMatch && !numMatch && !setMatch) return false;
        }

        const isOwned = !!userCollectionMap[card.id];
        if (statusFilter === 'owned' && !isOwned) return false;
        if (statusFilter === 'missing' && isOwned) return false;

        if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'rarity') {
          return (a.rarity || '').localeCompare(b.rarity || '');
        } else {
          const numA = parseInt(a.number, 10) || 9999;
          const numB = parseInt(b.number, 10) || 9999;
          return numA - numB;
        }
      });
  }, [setCards, userCollectionMap, searchQuery, statusFilter, rarityFilter, sortBy]);

  const ownedCountInSet = selectedSetId === 'all_owned' ? setCards.length : Object.keys(userCollectionMap).length;
  const missingCountInSet = selectedSetId === 'all_owned' ? 0 : setCards.length - ownedCountInSet;

  return (
    <div className="app-container">
      <Navbar
        sets={sets}
        selectedSetId={selectedSetId}
        onSelectSet={setSelectedSetId}
        onOpenStats={() => setShowStatsModal(true)}
        totalOwnedCount={stats?.total_collected || 0}
        totalMarketValue={stats?.total_market_value || 0}
      />

      <main className="main-content">
        <SetBanner
          set={currentSet}
          cardsCount={setCards.length}
          ownedCount={ownedCountInSet}
          setValue={currentSetValue}
          isAllOwnedMode={selectedSetId === 'all_owned'}
          onMarkAll={handleMarkAllOwned}
          onClearAll={handleClearSet}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          rarityFilter={rarityFilter}
          onRarityFilterChange={setRarityFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          rarities={setRarities}
          totalCount={setCards.length}
          ownedCount={ownedCountInSet}
          missingCount={missingCountInSet}
        />

        <CardGrid
          cards={filteredCards}
          userCollectionMap={userCollectionMap}
          isLoading={isLoadingCards || isLoadingSets}
          onToggleCard={handleToggleCard}
          onQuantityChange={handleQuantityChange}
          onInspectCard={setInspectedCard}
        />
      </main>

      {/* Inspect Card Modal */}
      {inspectedCard && (
        <CardModal
          card={inspectedCard}
          isOwned={!!userCollectionMap[inspectedCard.id]}
          userCardEntry={userCollectionMap[inspectedCard.id]}
          onToggle={handleToggleCard}
          onSavePrice={handleSavePrice}
          onClose={() => setInspectedCard(null)}
        />
      )}

      {/* Overall Collection Stats Modal */}
      {showStatsModal && (
        <StatsModal
          stats={stats}
          sets={sets}
          onClose={() => setShowStatsModal(false)}
          onSelectSet={setSelectedSetId}
        />
      )}
    </div>
  );
}
