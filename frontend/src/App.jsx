import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/Navbar';
import SetBanner from './components/SetBanner';
import FilterBar from './components/FilterBar';
import CardGrid from './components/CardGrid';
import CardModal from './components/CardModal';
import StatsModal from './components/StatsModal';
import GitHubSettingsModal from './components/GitHubSettingsModal';
import SetSelectorModal from './components/SetSelectorModal';
import CardScannerModal from './components/CardScannerModal';
import MobileBottomNav from './components/MobileBottomNav';
import placeholderImg from './assets/placeholder.png';
import {
  fetchSets,
  fetchSetCards,
  searchGlobalCards,
  fetchUserCollection,
  toggleCardOwnership,
  toggleWantedCard,
  updateCardQuantity,
  updateCardPrice,
  bulkToggleSet,
  fetchCollectionStats,
  backupCollection,
  restoreCollection,
  startBackgroundSync,
  canonicalSetId,
  getCardMatchKey,
  findUserCardEntry
} from './api';

export default function App() {
  const [sets, setSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('all_owned');
  const [setCards, setSetCards] = useState([]);
  const [userCollection, setUserCollection] = useState([]);
  const [stats, setStats] = useState(null);
  
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('set');
  const [globalCards, setGlobalCards] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('number_asc');
  
  const [inspectedCard, setInspectedCard] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showGitHubSettings, setShowGitHubSettings] = useState(false);
  const [showSetSelector, setShowSetSelector] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const searchInputRef = useRef(null);
  const isSearchingGlobal = searchScope === 'all' && searchQuery.trim().length >= 2;

  useEffect(() => {
    async function init() {
      setIsLoadingSets(true);
      const fetchedSets = await fetchSets();
      setSets(fetchedSets);
      setIsLoadingSets(false);
      
      const initialStats = await fetchCollectionStats();
      setStats(initialStats);
    }
    init();
  }, []);

  useEffect(() => {
    const handleFocusIn = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        document.body.classList.add('keyboard-open');
      }
    };
    const handleFocusOut = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        document.body.classList.remove('keyboard-open');
      }
    };
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleSelectSet = (id) => {
    setSearchQuery('');
    setSearchScope('set');
    setStatusFilter('all');
    setRarityFilter('all');
    setCategoryFilter('all');
    setPriceFilter('all');
    setSelectedSetId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setRarityFilter('all');
    setCategoryFilter('all');
    setPriceFilter('all');
    setSortBy('number_asc');
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    rarityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    priceFilter !== 'all' ||
    (sortBy !== 'number' && sortBy !== 'number_asc') ||
    !!searchQuery.trim();

  const handleFocusSearch = () => {
    setSearchScope('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  const refreshCurrentView = useCallback(async () => {
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
        image_url: c.image_url || placeholderImg,
        market_price: c.market_price || 0,
        custom_price: c.custom_price || 0,
        images: { small: c.image_url || placeholderImg, large: c.image_url || placeholderImg },
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
        image_url: c.image_url || placeholderImg,
        market_price: c.market_price || 0,
        custom_price: c.custom_price || 0,
        images: { small: c.image_url || placeholderImg, large: c.image_url || placeholderImg },
        set: { id: c.set_id, name: c.set_id }
      })));
      setUserCollection(wantedCards);
    } else {
      const [cardsData, userColData] = await Promise.all([
        fetchSetCards(selectedSetId, (enrichedCards) => {
          setSetCards(enrichedCards);
        }),
        fetchUserCollection(selectedSetId)
      ]);
      setSetCards(cardsData);
      setUserCollection(userColData);
    }
  }, [selectedSetId]);

  useEffect(() => {
    const cleanup = startBackgroundSync(() => {
      refreshCurrentView();
    });
    return cleanup;
  }, [refreshCurrentView]);

  useEffect(() => {
    if (!selectedSetId) return;

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
          image_url: c.image_url || placeholderImg,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || placeholderImg, large: c.image_url || placeholderImg },
          set: { id: c.set_id, name: c.set_id }
        }));
        setSetCards(formattedCards);
        setUserCollection(allUserCards);
      } else if (selectedSetId === 'wanted_list') {
        const rawCollection = await fetchUserCollection(null, true);
        const wantedCards = (rawCollection || []).filter(c => c.is_wanted === true);
        const formattedCards = wantedCards.map(c => ({
          id: c.card_id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          supertype: 'Pokémon',
          image_url: c.image_url || placeholderImg,
          market_price: c.market_price || 0,
          custom_price: c.custom_price || 0,
          images: { small: c.image_url || placeholderImg, large: c.image_url || placeholderImg },
          set: { id: c.set_id, name: c.set_id }
        }));
        setSetCards(formattedCards);
        setUserCollection(wantedCards);
      } else {
        const [cardsData, userColData] = await Promise.all([
          fetchSetCards(selectedSetId, (enrichedCards) => {
            setSetCards(enrichedCards);
          }),
          fetchUserCollection(selectedSetId)
        ]);
        setSetCards(cardsData);
        setUserCollection(userColData);
      }

      setIsLoadingCards(false);
    }
    loadSetData();
  }, [selectedSetId]);

  useEffect(() => {
    if (searchScope !== 'all') return;
    const query = searchQuery.trim();
    if (query.length < 2) return;

    let isCancelled = false;

    const timer = setTimeout(async () => {
      setIsLoadingGlobal(true);
      try {
        const results = await searchGlobalCards(query, (enrichedCards) => {
          if (!isCancelled && searchScope === 'all' && searchQuery.trim().length >= 2) {
            setGlobalCards(enrichedCards);
          }
        });
        if (!isCancelled) {
          setGlobalCards(results);
        }
      } catch {
        if (!isCancelled) setGlobalCards([]);
      } finally {
        if (!isCancelled) setIsLoadingGlobal(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, searchScope]);

  const userCollectionMap = useMemo(() => {
    const map = {};
    for (const item of userCollection) {
      if (!item) continue;
      if (item.card_id) map[item.card_id] = item;
      const k = getCardMatchKey(item.set_id, item.number);
      if (k && !map[k]) map[k] = item;
    }
    return map;
  }, [userCollection]);

  const currentSet = useMemo(() => {
    if (isSearchingGlobal) return null;
    return sets.find(s => s.id === selectedSetId || canonicalSetId(s.id) === canonicalSetId(selectedSetId));
  }, [sets, selectedSetId, isSearchingGlobal]);

  const currentSetValue = useMemo(() => {
    if (isSearchingGlobal) return 0;
    if (selectedSetId === 'all_owned') return stats?.total_market_value || 0;
    if (selectedSetId === 'wanted_list') return stats?.total_wanted_cost || 0;
    if (!stats?.set_values || !selectedSetId) return 0;
    return stats.set_values[selectedSetId] || stats.set_values[canonicalSetId(selectedSetId)] || 0;
  }, [stats, selectedSetId, isSearchingGlobal]);

  const handleToggleCard = async (card, marketPrice = 0) => {
    const existing = findUserCardEntry(userCollectionMap, card);
    const isCurrentlyOwned = !!(existing && existing.quantity > 0);
    const targetCardId = existing ? existing.card_id : card.id;
    const cardSetId = card.set?.id || card.set_id || existing?.set_id || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' && !isSearchingGlobal ? selectedSetId : '');
    const cardNum = card.number || card.localId || existing?.number || '';
    const imgUrl = card.images?.small || card.images?.large || card.image_url || existing?.image_url || placeholderImg;
    const cmPrice = card.cardmarket?.prices?.averageSellPrice;
    const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
    const mPrice = marketPrice || card.market_price || cmPrice || tcgPrice || existing?.market_price || 0;

    if (isCurrentlyOwned) {
      if (existing?.is_wanted) {
        setUserCollection(prev => prev.map(c => c.card_id === targetCardId ? { ...c, quantity: 0 } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== targetCardId));
      }
      if (selectedSetId === 'all_owned' && !isSearchingGlobal) {
        setSetCards(prev => prev.filter(c => c.id !== targetCardId && c.id !== card.id));
      }
    } else {
      const wasWanted = !!(existing && existing.is_wanted);
      const newCardEntry = {
        card_id: targetCardId,
        set_id: cardSetId,
        name: card.name,
        number: cardNum,
        rarity: card.rarity || existing?.rarity || '',
        image_url: imgUrl,
        market_price: mPrice,
        custom_price: existing?.custom_price || 0,
        notes: existing?.notes || '',
        quantity: 1,
        is_wanted: wasWanted
      };
      setUserCollection(prev => [...prev.filter(c => c.card_id !== targetCardId), newCardEntry]);
    }

    try {
      const res = await toggleCardOwnership({
        card_id: targetCardId,
        set_id: cardSetId,
        name: card.name,
        number: cardNum,
        rarity: card.rarity || existing?.rarity || '',
        image_url: imgUrl,
        market_price: mPrice
      });

      if (res?.card) {
        setUserCollection(prev => {
          const idx = prev.findIndex(c => c.card_id === targetCardId);
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
      console.error('Failed to sync toggle with collection storage', err);
    }
  };

  const handleToggleWanted = async (card) => {
    const existing = findUserCardEntry(userCollectionMap, card);
    const targetCardId = existing ? existing.card_id : card.id;
    const isWantedCurrently = !!(existing && existing.is_wanted === true);
    const cardSetId = card.set?.id || card.set_id || existing?.set_id || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' && !isSearchingGlobal ? selectedSetId : '');
    const cardNum = card.number || card.localId || existing?.number || '';
    const imgUrl = card.images?.small || card.images?.large || card.image_url || existing?.image_url || placeholderImg;
    const cmPrice = card.cardmarket?.prices?.averageSellPrice;
    const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
    const mPrice = card.market_price || cmPrice || tcgPrice || existing?.market_price || 0;

    if (isWantedCurrently) {
      if (existing && existing.quantity > 0) {
        setUserCollection(prev => prev.map(c => c.card_id === targetCardId ? { ...c, is_wanted: false } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== targetCardId));
      }
      if (selectedSetId === 'wanted_list' && !isSearchingGlobal) {
        setSetCards(prev => prev.filter(c => c.id !== targetCardId && c.id !== card.id));
      }
    } else {
      if (existing) {
        setUserCollection(prev => prev.map(c => c.card_id === targetCardId ? { ...c, is_wanted: true } : c));
      } else {
        const newEntry = {
          card_id: targetCardId,
          set_id: cardSetId,
          name: card.name,
          number: cardNum,
          rarity: card.rarity || '',
          image_url: imgUrl,
          market_price: mPrice,
          custom_price: 0,
          quantity: 0,
          is_wanted: true
        };
        setUserCollection(prev => [...prev.filter(c => c.card_id !== targetCardId), newEntry]);
      }
    }

    try {
      const res = await toggleWantedCard({
        card_id: targetCardId,
        set_id: cardSetId,
        name: card.name,
        number: cardNum,
        rarity: card.rarity || existing?.rarity || '',
        image_url: imgUrl,
        market_price: mPrice
      });

      if (res?.card) {
        setUserCollection(prev => {
          const idx = prev.findIndex(c => c.card_id === targetCardId);
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

  const handleSavePrice = async (cardId, customPrice, notes) => {
    const existing = findUserCardEntry(userCollectionMap, { id: cardId });
    const targetCardId = existing ? existing.card_id : cardId;

    setUserCollection(prev =>
      prev.map(c => c.card_id === targetCardId ? { ...c, custom_price: customPrice, notes } : c)
    );

    try {
      await updateCardPrice(targetCardId, customPrice, notes);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to save custom price', err);
    }
  };

  const handleQuantityChange = async (cardId, newQty) => {
    const existing = findUserCardEntry(userCollectionMap, { id: cardId });
    const targetCardId = existing ? existing.card_id : cardId;

    if (newQty <= 0) {
      if (existing?.is_wanted) {
        setUserCollection(prev => prev.map(c => c.card_id === targetCardId ? { ...c, quantity: 0 } : c));
      } else {
        setUserCollection(prev => prev.filter(c => c.card_id !== targetCardId));
      }
      if (selectedSetId === 'all_owned' && !isSearchingGlobal) {
        setSetCards(prev => prev.filter(c => c.id !== targetCardId && c.id !== cardId));
      }
    } else {
      setUserCollection(prev =>
        prev.map(c => c.card_id === targetCardId ? { ...c, quantity: newQty } : c)
      );
    }

    try {
      await updateCardQuantity(targetCardId, newQty);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Failed to update quantity', err);
    }
  };

  const handleBackup = async (setId = null) => {
    const targetSet = setId || (selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' && !isSearchingGlobal ? selectedSetId : null);
    try {
      const data = await backupCollection(targetSet);
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `backup_${targetSet || 'all_sets'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert(`Backup created successfully!\nDownloaded: ${data.filename} (${data.total_cards} cards)`);
    } catch (err) {
      alert(`Failed to create backup: ${err.message}`);
    }
  };

  const handleRestore = async (file = null, setId = null) => {
    try {
      const res = await restoreCollection({ file, setId });
      alert(`${res.message}!`);
      const updatedStats = await fetchCollectionStats();
      setStats(updatedStats);
      refreshCurrentView();
    } catch (err) {
      alert(`Failed to restore collection: ${err.message}`);
    }
  };

  const handleMarkAllOwned = async () => {
    if (selectedSetId === 'all_owned' || selectedSetId === 'wanted_list' || isSearchingGlobal) return;
    if (!window.confirm(`Are you sure you want to mark all ${setCards.length} cards in ${currentSet?.name} as owned?`)) {
      return;
    }

    const allEntries = setCards.map(c => ({
      card_id: c.id,
      set_id: selectedSetId,
      name: c.name,
      number: c.number,
      rarity: c.rarity || '',
      image_url: c.images?.small || c.image_url || placeholderImg,
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

  const isWantedView = selectedSetId === 'wanted_list' && !isSearchingGlobal;
  const isAllOwnedView = selectedSetId === 'all_owned' && !isSearchingGlobal;

  const currentSetName = useMemo(() => {
    if (isAllOwnedView) return 'My Binder';
    if (isWantedView) return 'Wishlist';
    return currentSet?.name || 'This Set';
  }, [isAllOwnedView, isWantedView, currentSet]);

  const activeDisplayName = isSearchingGlobal
    ? `Search All: "${searchQuery}"`
    : isAllOwnedView
    ? 'My Binder'
    : isWantedView
    ? 'My Wishlist'
    : currentSet?.name || 'Select Set';

  const searchFilteredCards = useMemo(() => {
    if (searchScope === 'all') {
      if (searchQuery.trim().length >= 2) return globalCards;
      return [];
    }
    if (!searchQuery.trim()) return setCards;
    const q = searchQuery.trim().toLowerCase();
    return setCards.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const numMatch = String(c.number || c.localId || '').toLowerCase().includes(q);
      return nameMatch || numMatch;
    });
  }, [searchScope, searchQuery, globalCards, setCards]);

  const setRarities = useMemo(() => {
    const raritiesSet = new Set();
    searchFilteredCards.forEach(c => {
      const userEntry = findUserCardEntry(userCollectionMap, c);
      const r = c.rarity || userEntry?.rarity;
      if (r && r.trim()) raritiesSet.add(r.trim());
    });
    if (raritiesSet.size === 0) {
      return ['Common', 'Uncommon', 'Rare', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Promo'];
    }
    return Array.from(raritiesSet).sort();
  }, [searchFilteredCards, userCollectionMap]);

  const duplicatesCountInView = useMemo(() => {
    return searchFilteredCards.filter(c => {
      const entry = findUserCardEntry(userCollectionMap, c);
      return !!(entry && entry.quantity > 1);
    }).length;
  }, [searchFilteredCards, userCollectionMap]);

  const filteredCards = useMemo(() => {
    return searchFilteredCards
      .filter((card) => {
        const userEntry = findUserCardEntry(userCollectionMap, card);
        const isOwned = !!(userEntry && userEntry.quantity > 0);
        const isWanted = !!(userEntry && userEntry.is_wanted === true);
        const qty = userEntry?.quantity || 0;

        if (selectedSetId === 'wanted_list' && !isSearchingGlobal) {
          if (!isWanted) return false;
          if (statusFilter === 'owned' && !isOwned) return false;
          if (statusFilter === 'unowned' && isOwned) return false;
        } else {
          if (statusFilter === 'owned' && !isOwned) return false;
          if (statusFilter === 'missing' && isOwned) return false;
          if (statusFilter === 'wanted' && !isWanted) return false;
          if (statusFilter === 'duplicates' && qty <= 1) return false;
        }

        const cardRarity = card.rarity || userEntry?.rarity || '';
        const cardName = card.name || '';
        if (rarityFilter !== 'all') {
          if (rarityFilter === 'hits') {
            const isHit = /illustration|special|ultra|double|hyper|secret|ace spec|rare holo|promo|ex|gx|\bv\b|vstar|vmax/i.test(cardRarity) || /\b(ex|gx|v|vstar|vmax)\b/i.test(cardName);
            if (!isHit) return false;
          } else if (rarityFilter === 'special_art') {
            if (!/illustration/i.test(cardRarity)) return false;
          } else if (rarityFilter === 'ex_ultra') {
            const isEx = /ultra|double|ex|\bv\b/i.test(cardRarity) || /\b(ex|v|vstar|vmax)\b/i.test(cardName);
            if (!isEx) return false;
          } else if (rarityFilter === 'holos') {
            if (!/holo/i.test(cardRarity)) return false;
          } else {
            if (cardRarity.toLowerCase() !== rarityFilter.toLowerCase()) return false;
          }
        }

        if (categoryFilter !== 'all') {
          const category = (card.supertype || userEntry?.supertype || '').toLowerCase();
          const name = card.name.toLowerCase();
          if (categoryFilter === 'pokemon') {
            if (category && category !== 'pokémon' && category !== 'pokemon') return false;
          } else if (categoryFilter === 'trainer') {
            const isTrainer = category === 'trainer' || /supporter|item|stadium|tool/.test(category);
            if (!isTrainer) return false;
          } else if (categoryFilter === 'energy') {
            const isEnergy = category === 'energy' || name.includes('energy');
            if (!isEnergy) return false;
          }
        }

        if (priceFilter !== 'all') {
          const cmPrice = card.cardmarket?.prices?.averageSellPrice;
          const tcgPrice = card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market;
          const price = userEntry?.custom_price || userEntry?.market_price || card.market_price || cmPrice || tcgPrice || 0;
          if (priceFilter === 'has_price' && price <= 0) return false;
          if (priceFilter === 'no_price' && price > 0) return false;
          if (priceFilter === 'min_1' && price < 1) return false;
          if (priceFilter === 'min_5' && price < 5) return false;
          if (priceFilter === 'min_10' && price < 10) return false;
          if (priceFilter === 'min_25' && price < 25) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const userA = findUserCardEntry(userCollectionMap, a);
        const userB = findUserCardEntry(userCollectionMap, b);
        const cmA = a.cardmarket?.prices?.averageSellPrice;
        const tcgA = a.tcgplayer?.prices?.holofoil?.market || a.tcgplayer?.prices?.normal?.market;
        const priceA = userA?.custom_price || userA?.market_price || a.market_price || cmA || tcgA || 0;

        const cmB = b.cardmarket?.prices?.averageSellPrice;
        const tcgB = b.tcgplayer?.prices?.holofoil?.market || b.tcgplayer?.prices?.normal?.market;
        const priceB = userB?.custom_price || userB?.market_price || b.market_price || cmB || tcgB || 0;

        const qtyA = userA?.quantity || 0;
        const qtyB = userB?.quantity || 0;

        if (sortBy === 'price_desc') {
          return priceB - priceA;
        } else if (sortBy === 'price_asc') {
          return priceA - priceB;
        } else if (sortBy === 'qty_desc') {
          return qtyB - qtyA;
        } else if (sortBy === 'name_asc' || sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortBy === 'name_desc') {
          return b.name.localeCompare(a.name);
        } else if (sortBy === 'rarity') {
          const rA = a.rarity || userA?.rarity || '';
          const rB = b.rarity || userB?.rarity || '';
          return rA.localeCompare(rB);
        } else if (sortBy === 'number_desc') {
          const numA = parseInt(a.number, 10) || 0;
          const numB = parseInt(b.number, 10) || 0;
          return numB - numA;
        } else {
          const numA = parseInt(a.number, 10) || 9999;
          const numB = parseInt(b.number, 10) || 9999;
          return numA - numB;
        }
      });
  }, [searchFilteredCards, userCollectionMap, statusFilter, rarityFilter, categoryFilter, priceFilter, sortBy, selectedSetId, isSearchingGlobal]);

  const ownedCountInFullSet = isAllOwnedView
    ? setCards.length
    : isWantedView
    ? setCards.filter(c => {
        const entry = findUserCardEntry(userCollectionMap, c);
        return !!(entry && entry.quantity > 0);
      }).length
    : setCards.filter(c => {
        const entry = findUserCardEntry(userCollectionMap, c);
        return !!(entry && entry.quantity > 0);
      }).length;

  const ownedCountInView = isAllOwnedView && !searchQuery.trim()
    ? setCards.length
    : isWantedView
    ? searchFilteredCards.filter(c => {
        const entry = findUserCardEntry(userCollectionMap, c);
        return !!(entry && entry.quantity > 0);
      }).length
    : searchFilteredCards.filter(c => {
        const entry = findUserCardEntry(userCollectionMap, c);
        return !!(entry && entry.quantity > 0);
      }).length;

  const wantedCountInView = searchFilteredCards.filter(c => {
    const entry = findUserCardEntry(userCollectionMap, c);
    return !!(entry && entry.is_wanted === true);
  }).length;

  const missingCountInView = isWantedView
    ? searchFilteredCards.filter(c => {
        const entry = findUserCardEntry(userCollectionMap, c);
        return !(entry && entry.quantity > 0);
      }).length
    : isAllOwnedView && !searchQuery.trim()
    ? 0
    : Math.max(0, searchFilteredCards.length - ownedCountInView);

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchScope('set');
  };

  const handleSearchAllSets = () => {
    setSearchScope('all');
  };

  return (
    <div className="app-container">
      <Navbar
        sets={sets}
        selectedSetId={isSearchingGlobal ? 'global_search' : selectedSetId}
        activeSetName={activeDisplayName}
        onSelectSet={handleSelectSet}
        onOpenSetSelector={() => setShowSetSelector(true)}
        onOpenStats={() => setShowStatsModal(true)}
        onOpenGitHubSettings={() => setShowGitHubSettings(true)}
        onOpenScanner={() => setShowScannerModal(true)}
        totalOwnedCount={stats?.total_collected || 0}
        totalWantedCount={stats?.total_wanted || 0}
        totalMarketValue={stats?.total_market_value || 0}
        searchQuery={searchQuery}
      />

      <main className="main-content">
        <SetBanner
          set={currentSet}
          cardsCount={isSearchingGlobal ? globalCards.length : setCards.length}
          ownedCount={isSearchingGlobal ? ownedCountInView : ownedCountInFullSet}
          setValue={currentSetValue}
          isAllOwnedMode={isAllOwnedView}
          isWantedMode={isWantedView}
          isGlobalSearchMode={isSearchingGlobal}
          searchQuery={searchQuery}
          onMarkAll={handleMarkAllOwned}
        />

        <FilterBar
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchScope={searchScope}
          onSearchScopeChange={setSearchScope}
          currentSetName={currentSetName}
          onOpenScanner={() => setShowScannerModal(true)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          rarityFilter={rarityFilter}
          onRarityFilterChange={setRarityFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          priceFilter={priceFilter}
          onPriceFilterChange={setPriceFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          rarities={setRarities}
          totalCount={searchFilteredCards.length}
          ownedCount={ownedCountInView}
          missingCount={missingCountInView}
          wantedCount={wantedCountInView}
          duplicatesCount={duplicatesCountInView}
          isWantedMode={isWantedView}
        />

        <CardGrid
          cards={filteredCards}
          userCollectionMap={userCollectionMap}
          isLoading={isSearchingGlobal ? isLoadingGlobal : (isLoadingCards || isLoadingSets)}
          loadingMessage={isSearchingGlobal ? 'Searching across all Pokémon sets...' : 'Loading Pokémon Cards...'}
          onToggleCard={handleToggleCard}
          onToggleWanted={handleToggleWanted}
          onQuantityChange={handleQuantityChange}
          onInspectCard={setInspectedCard}
          searchQuery={searchQuery}
          onClearSearch={handleClearSearch}
          searchScope={searchScope}
          currentSetName={currentSetName}
          onSearchAllSets={handleSearchAllSets}
        />
      </main>

      {inspectedCard && (
        <CardModal
          card={inspectedCard}
          isOwned={!!(findUserCardEntry(userCollectionMap, inspectedCard) && findUserCardEntry(userCollectionMap, inspectedCard).quantity > 0)}
          isWanted={!!(findUserCardEntry(userCollectionMap, inspectedCard) && findUserCardEntry(userCollectionMap, inspectedCard).is_wanted === true)}
          userCardEntry={findUserCardEntry(userCollectionMap, inspectedCard)}
          onToggle={handleToggleCard}
          onToggleWanted={handleToggleWanted}
          onSavePrice={handleSavePrice}
          onClose={() => setInspectedCard(null)}
        />
      )}

      {showStatsModal && (
        <StatsModal
          stats={stats}
          sets={sets}
          onClose={() => setShowStatsModal(false)}
          onSelectSet={handleSelectSet}
          onBackup={handleBackup}
          onRestore={handleRestore}
        />
      )}

      {showGitHubSettings && (
        <GitHubSettingsModal
          onClose={() => setShowGitHubSettings(false)}
          onCollectionUpdated={refreshCurrentView}
        />
      )}

      {showSetSelector && (
        <SetSelectorModal
          sets={sets}
          selectedSetId={isSearchingGlobal ? '' : selectedSetId}
          onSelectSet={(id) => {
            handleSelectSet(id);
            setShowSetSelector(false);
          }}
          onClose={() => setShowSetSelector(false)}
          totalOwnedCount={stats?.total_collected || 0}
          totalWantedCount={stats?.total_wanted || 0}
        />
      )}

      <CardScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        sets={sets}
        currentSetId={selectedSetId !== 'all_owned' && selectedSetId !== 'wanted_list' && !isSearchingGlobal ? selectedSetId : ''}
        userCollectionMap={userCollectionMap}
        onToggleCard={handleToggleCard}
        onToggleWanted={handleToggleWanted}
        onQuantityChange={handleQuantityChange}
        onInspectCard={setInspectedCard}
      />

      <MobileBottomNav
        currentView={selectedSetId}
        isSearching={isSearchingGlobal}
        onSelectView={(view) => {
          setSearchQuery('');
          setSearchScope('set');
          setStatusFilter('all');
          setSelectedSetId(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSetSelector={() => setShowSetSelector(true)}
        onFocusSearch={handleFocusSearch}
        onOpenStats={() => setShowStatsModal(true)}
        totalWantedCount={stats?.total_wanted || 0}
        totalOwnedCount={stats?.total_collected || 0}
      />
    </div>
  );
}
