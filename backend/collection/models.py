from django.db import models

class CollectedCard(models.Model):
    card_id = models.CharField(max_length=100, primary_key=True)
    set_id = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=255, blank=True)
    number = models.CharField(max_length=50, blank=True)
    rarity = models.CharField(max_length=100, blank=True)
    image_url = models.URLField(max_length=500, blank=True)
    quantity = models.IntegerField(default=1)
    is_foil = models.BooleanField(default=False)
    is_wanted = models.BooleanField(default=False)
    market_price = models.FloatField(default=0.0)
    custom_price = models.FloatField(default=0.0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.card_id}) - wanted:{self.is_wanted}"
