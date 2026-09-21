import React from 'react';
import { Layers, BookOpen, Search, Heart, PieChart } from 'lucide-react';

export default function MobileBottomNav({
  currentView,
  isSearching = false,
  onSelectView,
  onOpenSetSelector,
  onFocusSearch,
  onOpenStats,
  totalWantedCount = 0,
  totalOwnedCount = 0
}) {
  const isBinderActive = !isSearching && currentView === 'all_owned';
  const isWantedActive = !isSearching && currentView === 'wanted_list';
  const isSetsActive = !isSearching && currentView !== 'all_owned' && currentView !== 'wanted_list';

  return (
    <nav className="mobile-bottom-nav">
      <button
        type="button"
        className={`mobile-nav-item ${isSetsActive ? 'active' : ''}`}
        onClick={onOpenSetSelector}
        title="Browse Pokémon Sets"
      >
        <div className="mobile-nav-icon-wrap">
          <Layers size={20} />
        </div>
        <span className="mobile-nav-label">Sets</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${isBinderActive ? 'active' : ''}`}
        onClick={() => onSelectView('all_owned')}
        title="My Binder"
      >
        <div className="mobile-nav-icon-wrap">
          <BookOpen size={20} />
          {totalOwnedCount > 0 && (
            <span className="mobile-nav-badge binder-badge">
              {totalOwnedCount > 999 ? '999+' : totalOwnedCount}
            </span>
          )}
        </div>
        <span className="mobile-nav-label">Binder</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${isSearching ? 'active' : ''}`}
        onClick={onFocusSearch}
        title="Search All Sets"
      >
        <div className="mobile-nav-icon-wrap search-icon-wrap">
          <Search size={20} />
        </div>
        <span className="mobile-nav-label">Search</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-item ${isWantedActive ? 'active' : ''}`}
        onClick={() => onSelectView('wanted_list')}
        title="My Wanted Wishlist"
      >
        <div className="mobile-nav-icon-wrap">
          <Heart size={20} fill={isWantedActive ? '#ff007f' : 'none'} />
          {totalWantedCount > 0 && (
            <span className="mobile-nav-badge wanted-badge">
              {totalWantedCount > 99 ? '99+' : totalWantedCount}
            </span>
          )}
        </div>
        <span className="mobile-nav-label">Wanted</span>
      </button>

      <button
        type="button"
        className="mobile-nav-item"
        onClick={onOpenStats}
        title="View Collection Stats & Sync"
      >
        <div className="mobile-nav-icon-wrap">
          <PieChart size={20} />
        </div>
        <span className="mobile-nav-label">Stats</span>
      </button>
    </nav>
  );
}
