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
  toggleWantedCard,
  updateCardQuantity,
  updateCardPrice,
  bulkToggleSet,
  fetchCollectionStats,
  backupCollection,
  restoreCollection
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

    setStatusFilter('all');

    async function loadSetData() {
      setIsLoadingCards(true);

      if (selectedSetId === 'all_owned') {
        const allUserCards = await fetchUserCollection();
        const ownedOnly = allUserCards.filter(c => c.quantity > 0);
        const formattedCards = ownedOnly.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          image_url: c.image_url,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || 'https://images.pokemontcg.io/sv3/1.png', large: c.image_url || 'https://images.pokemontcg.io/sv3/1.png' },
          set: { id: c.set_id, name: c.set_id }
        }));
        setSetCards(formattedCards);
        setUserCollection(allUserCards);
      } else if (selectedSetId === 'wanted_list') {
        const wantedCards = await fetchUserCollection(null, true);
        const formattedCards = wantedCards.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          image_url: c.image_url,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || 'https://images.pokemontcg.io/sv3/1.png', large: c.image_url || 'https://images.pokemontcg.io/sv3/1.png' },
          set: { id: c.set_id, name: c.set_id }
        }));
        setSetCards(formattedCards);
        setUserCollection(wantedCards);
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
    if (selectedSetId === 'wanted_list') return stats?.total_wanted_cost || 0;
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
    const existing = userCollectionMap[card.id];
    const isCurrentlyOwned = !!(existing && existing.quantity > 0);
    const cardSetId = card.set?.id || card.set_id || existing?.set_id || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' ? selectedSetId : '');
    const imgUrl = card.images?.small || card.images?.large || card.image_url || existing?.image_url || '';
    const cmPrice = card.cardmarket?.prices?.averageSellPrice;
    const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
    const mPrice = marketPrice || card.market_price || cmPrice || tcgPrice || existing?.market_price || 0;

    if (isCurrentlyOwned) {
      // If the card is also wanted, keep it in collection with quantity 0 and is_wanted true
      if (existing?.is_wanted) {
        setUserCollection(prev => prev.map(c => c.card_id === card.id ? { ...c, quantity: 0 } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== card.id));
      }
      if (selectedSetId === 'all_owned') {
        setSetCards(prev => prev.filter(c => c.id !== card.id));
      }
    } else {
      const wasWanted = !!(existing && existing.is_wanted);
      const newCardEntry = {
        card_id: card.id,
        set_id: cardSetId,
        name: card.name,
        number: card.number,
        rarity: card.rarity || '',
        image_url: imgUrl,
        market_price: mPrice,
        custom_price: existing?.custom_price || 0,
        notes: existing?.notes || '',
        quantity: 1,
        is_wanted: wasWanted
      };
      setUserCollection(prev => [...prev.filter(c => c.card_id !== card.id), newCardEntry]);
    }

    try {
      const res = await toggleCardOwnership({
        card_id: card.id,
        set_id: cardSetId,
        name: card.name,
        number: card.number,
        rarity: card.rarity || '',
        image_url: imgUrl,
        market_price: mPrice
      });

      if (res?.card) {
        setUserCollection(prev => {
          const idx = prev.findIndex(c => c.card_id === card.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = res.card;
            return copy;
          }
          return prev;
        });
      }

      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to sync toggle with backend', err);
    }
  };

  // Toggle card wanted status (Wishlist ❤️)
  const handleToggleWanted = async (card) => {
    const existing = userCollectionMap[card.id];
    const isWantedCurrently = !!(existing && existing.is_wanted === true);
    const cardSetId = card.set?.id || card.set_id || existing?.set_id || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' ? selectedSetId : '');
    const imgUrl = card.images?.small || card.images?.large || card.image_url || existing?.image_url || '';
    const cmPrice = card.cardmarket?.prices?.averageSellPrice;
    const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
    const mPrice = card.market_price || cmPrice || tcgPrice || existing?.market_price || 0;

    if (isWantedCurrently) {
      // Removing from wanted list
      if (existing && existing.quantity > 0) {
        setUserCollection(prev => prev.map(c => c.card_id === card.id ? { ...c, is_wanted: false } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== card.id));
      }
      if (selectedSetId === 'wanted_list') {
        setSetCards(prev => prev.filter(c => c.id !== card.id));
      }
    } else {
      // Adding to wanted list
      if (existing) {
        setUserCollection(prev => prev.map(c => c.card_id === card.id ? { ...c, is_wanted: true } : c));
      } else {
        const newEntry = {
          card_id: card.id,
          set_id: cardSetId,
          name: card.name,
          number: card.number,
          rarity: card.rarity || '',
          image_url: imgUrl,
          market_price: mPrice,
          custom_price: 0,
          quantity: 0,
          is_wanted: true
        };
        setUserCollection(prev => [...prev.filter(c => c.card_id !== card.id), newEntry]);
      }
    }

    try {
      const res = await toggleWantedCard({
        card_id: card.id,
        set_id: cardSetId,
        name: card.name,
        number: card.number,
        rarity: card.rarity || '',
        image_url: imgUrl,
        market_price: mPrice
      });

      if (res?.card) {
        setUserCollection(prev => {
          const idx = prev.findIndex(c => c.card_id === card.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = res.card;
            return copy;
          }
          return [...prev, res.card];
        });
      }

      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed toggle wanted status', err);
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
    const existing = userCollectionMap[cardId];
    if (newQty <= 0) {
      if (existing?.is_wanted) {
        setUserCollection(prev => prev.map(c => c.card_id === cardId ? { ...c, quantity: 0 } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== cardId));
      }
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

  // Backup collection (current set or all)
  const handleBackup = async (setId = null) => {
    const targetSet = setId || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' ? selectedSetId : null);
    try {
      const data = await backupCollection(targetSet);
      // Trigger download
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `backup_${targetSet || 'all_sets'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert(`✓ Backup created successfully!\nDownloaded: ${data.filename} (${data.total_cards} cards)`);
    } catch (err) {
      alert(`Failed to create backup: ${err.message}`);
    }
  };

  // Restore collection (from file upload or server backup)
  const handleRestore = async (file = null, setId = null) => {
    try {
      const res = await restoreCollection({ file, setId });
      alert(`✓ ${res.message}!`);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
      if (selectedSetId === 'all_owned') {
        const allUserCards = await fetchUserCollection();
        const ownedOnly = allUserCards.filter(c => c.quantity > 0);
        setSetCards(ownedOnly.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          image_url: c.image_url,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || 'https://images.pokemontcg.io/sv3/1.png', large: c.image_url || 'https://images.pokemontcg.io/sv3/1.png' },
          set: { id: c.set_id, name: c.set_id }
        })));
        setUserCollection(allUserCards);
      } else if (selectedSetId === 'wanted_list') {
        const wantedCards = await fetchUserCollection(null, true);
        setSetCards(wantedCards.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          image_url: c.image_url,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || 'https://images.pokemontcg.io/sv3/1.png', large: c.image_url || 'https://images.pokemontcg.io/sv3/1.png' },
          set: { id: c.set_id, name: c.set_id }
        })));
        setUserCollection(wantedCards);
      } else {
        const [cardsData, userColData] = await Promise.all([
          fetchSetCards(selectedSetId),
          fetchUserCollection(selectedSetId)
        ]);
        setSetCards(cardsData);
        setUserCollection(userColData);
      }
    } catch (err) {
      alert(`Failed to restore collection: ${err.message}`);
    }
  };

  // Bulk action: Mark All as Owned
  const handleMarkAllOwned = async () => {
    if (selectedSetId === 'all_owned' || selectedSetId === 'wanted_list') return;
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
      quantity: 1,
      is_wanted: false
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
    if (selectedSetId === 'all_owned' || selectedSetId === 'wanted_list') return;
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

        const isOwned = !!(userCollectionMap[card.id] && userCollectionMap[card.id].quantity > 0);
        const isWanted = !!(userCollectionMap[card.id] && userCollectionMap[card.id].is_wanted === true);

        if (selectedSetId === 'wanted_list') {
          if (statusFilter === 'owned' && !isOwned) return false;
          if (statusFilter === 'unowned' && isOwned) return false;
        } else {
          if (statusFilter === 'owned' && !isOwned) return false;
          if (statusFilter === 'missing' && isOwned) return false;
          if (statusFilter === 'wanted' && !isWanted) return false;
        }

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
  }, [setCards, userCollectionMap, searchQuery, statusFilter, rarityFilter, sortBy, selectedSetId]);

  const isWantedView = selectedSetId === 'wanted_list';
  const isAllOwnedView = selectedSetId === 'all_owned';

  const ownedCountInSet = isAllOwnedView
    ? setCards.length
    : isWantedView
    ? setCards.filter(c => !!(userCollectionMap[c.id] && userCollectionMap[c.id].quantity > 0)).length
    : Object.keys(userCollectionMap).filter(k => userCollectionMap[k].quantity > 0 && userCollectionMap[k].set_id === selectedSetId).length;

  const wantedCountInSet = setCards.filter(c => !!(userCollectionMap[c.id] && userCollectionMap[c.id].is_wanted === true)).length;

  const missingCountInSet = isWantedView
    ? setCards.filter(c => !(userCollectionMap[c.id] && userCollectionMap[c.id].quantity > 0)).length
    : isAllOwnedView
    ? 0
    : setCards.length - ownedCountInSet;

  return (
    <div className="app-container">
      <Navbar
        sets={sets}
        selectedSetId={selectedSetId}
        onSelectSet={setSelectedSetId}
        onOpenStats={() => setShowStatsModal(true)}
        totalOwnedCount={stats?.total_collected || 0}
        totalWantedCount={stats?.total_wanted || 0}
        totalMarketValue={stats?.total_market_value || 0}
      />

      <main className="main-content">
        <SetBanner
          set={currentSet}
          cardsCount={setCards.length}
          ownedCount={ownedCountInSet}
          setValue={currentSetValue}
          isAllOwnedMode={selectedSetId === 'all_owned'}
          isWantedMode={selectedSetId === 'wanted_list'}
          onMarkAll={handleMarkAllOwned}
          onClearAll={handleClearSet}
          onBackup={handleBackup}
          onRestore={handleRestore}
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
          wantedCount={wantedCountInSet}
          isWantedMode={selectedSetId === 'wanted_list'}
        />

        <CardGrid
          cards={filteredCards}
          userCollectionMap={userCollectionMap}
          isLoading={isLoadingCards || isLoadingSets}
          onToggleCard={handleToggleCard}
          onToggleWanted={handleToggleWanted}
          onQuantityChange={handleQuantityChange}
          onInspectCard={setInspectedCard}
        />
      </main>

      {/* Inspect Card Modal */}
      {inspectedCard && (
        <CardModal
          card={inspectedCard}
          isOwned={!!(userCollectionMap[inspectedCard.id] && userCollectionMap[inspectedCard.id].quantity > 0)}
          isWanted={!!(userCollectionMap[inspectedCard.id] && userCollectionMap[inspectedCard.id].is_wanted === true)}
          userCardEntry={userCollectionMap[inspectedCard.id]}
          onToggle={handleToggleCard}
          onToggleWanted={handleToggleWanted}
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
          onBackup={handleBackup}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}
