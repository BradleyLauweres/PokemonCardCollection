from django.urls import path
from . import views

urlpatterns = [
    path('collection/', views.list_collection, name='list_collection'),
    path('collection/toggle/', views.toggle_card, name='toggle_card'),
    path('collection/wanted/', views.toggle_wanted, name='toggle_wanted'),
    path('collection/reset-wanted/', views.reset_wanted_status, name='reset_wanted_status'),
    path('collection/quantity/', views.update_quantity, name='update_quantity'),
    path('collection/price/', views.update_card_price, name='update_card_price'),
    path('collection/bulk-toggle/', views.bulk_toggle, name='bulk_toggle'),
    path('collection/stats/', views.get_stats, name='get_stats'),
    path('pokemon-tcg/sets/', views.proxy_sets, name='proxy_sets'),
    path('pokemon-tcg/cards/', views.proxy_set_cards, name='proxy_set_cards'),
]
