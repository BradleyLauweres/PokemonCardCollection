from rest_framework import serializers
from .models import CollectedCard

class CollectedCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollectedCard
        fields = '__all__'
