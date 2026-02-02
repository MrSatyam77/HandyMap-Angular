import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
interface FareEstimate {
    basefare: number;
    total: number;
}
@Component({
    selector: 'app-booking',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './booking.component.html',
    styleUrl: './booking.component.scss'
})
export class BookingComponent implements OnInit, OnDestroy {
    // Private variables
    private map?: L.Map;
    private pickupMarker?: L.Marker;
    private expertMarkers: L.Marker[] = [];
    private searchDebounce?: any;

    // Public variables
    public pickupAddress = signal('');
    public expertType = signal<string>('');
    public searchResults = signal<any[]>([]);
    public showSearchResults = signal(false);
    public showVehicleSelection = signal(false);
    public fareEstimate = signal<FareEstimate | null>(null);
    public bookingInProgress = signal(false);

    constructor(private router: Router, private http: HttpClient, private route: ActivatedRoute) { }

    // Public methods
    public onPickupFocus(): void {
        if (this.pickupAddress().length > 0) {
            this.searchLocation(this.pickupAddress());
        }
    }

    public onSearchInput(): void {
        const query = this.pickupAddress();
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
        if (query.length < 1) {
            this.searchResults.set([]);
            this.showSearchResults.set(false);
            return;
        }
        this.searchDebounce = setTimeout(() => {
            this.searchLocation(query);
        }, 200);
    }

    public async searchLocation(query: string): Promise<void> {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;
            const results = await this.http.get<any[]>(url).toPromise();
            if (results && results.length > 0) {
                this.searchResults.set(results);
                this.showSearchResults.set(true);
            } else {
                this.searchResults.set([]);
                this.showSearchResults.set(false);
            }
        } catch (error) {
            this.searchResults.set([]);
            this.showSearchResults.set(false);
        }
    }

    public selectSearchResult(result: any): void {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const latLng = L.latLng(lat, lng);
        const locationType = result.type || '';
        const locationClass = result.class || '';
        const displayName = result.display_name.toLowerCase();
        const isWater = locationType === 'waterway' ||
            locationClass === 'waterway' ||
            locationClass === 'natural' && (locationType === 'water' || locationType === 'bay' || locationType === 'ocean') ||
            displayName.includes('ocean') ||
            displayName.includes('sea') ||
            displayName.includes('bay') ||
            displayName.includes('lake') ||
            displayName.includes('river') ||
            displayName.includes('pond');
        if (isWater) {
            alert('⚠️ Cannot book expert in water! Please select a valid location on land.');
            this.showSearchResults.set(false);
            this.searchResults.set([]);
            return;
        }
        this.pickupAddress.set(result.display_name);
        this.showSearchResults.set(false);
        this.searchResults.set([]);
        if (this.pickupMarker) {
            this.map?.removeLayer(this.pickupMarker);
        }
        const pickupIcon = L.divIcon({
            html: '<div style="font-size: 32px;">📍</div>',
            className: 'custom-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        this.pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(this.map!);
        this.showNearbyExperts(latLng);
        const fare: FareEstimate = { basefare: 245, total: 245 };
        this.fareEstimate.set(fare);
        this.showVehicleSelection.set(true);
    }

    public useCurrentLocation(): void {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const latLng = L.latLng(lat, lng);
                    if (this.pickupMarker) {
                        this.map?.removeLayer(this.pickupMarker);
                    }
                    const pickupIcon = L.divIcon({
                        html: '<div style="font-size: 32px;">📍</div>',
                        className: 'custom-marker',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32]
                    });
                    this.pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(this.map!);
                    this.http.get<any>(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                        .subscribe({
                            next: (result) => {
                                this.pickupAddress.set(result.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                            },
                            error: () => {
                                this.pickupAddress.set(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                            }
                        });

                    this.showNearbyExperts(latLng);
                    const fare: FareEstimate = { basefare: 245, total: 245 };
                    this.fareEstimate.set(fare);
                    this.showVehicleSelection.set(true);
                },
                (error) => {
                    alert('Unable to get current location. Please enable location access.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    }

    public confirmBooking(): void {
        if (!this.pickupMarker) return;
        this.bookingInProgress.set(true);
        const pickupLatLng = this.pickupMarker.getLatLng();
        setTimeout(() => {
            this.bookingInProgress.set(false);
            this.router.navigate(['/expert-tracking'], {
                queryParams: {
                    fare: this.fareEstimate()?.total || 245,
                    pickupLat: pickupLatLng.lat,
                    pickupLng: pickupLatLng.lng
                }
            });
        }, 2000);
    }

    public goBack(): void {
        this.router.navigate(['/home']);
    }

    private generateNearbyExperts(center: L.LatLng, count: number = 5): Array<{ lat: number, lng: number, id: string, name: string }> {
        const experts = [];
        const radius = 0.1;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const distance = radius * (0.3 + Math.random() * 0.7);
            experts.push({
                id: `expert_${i + 1}`,
                name: `Expert ${i + 1}`,
                lat: center.lat + distance * Math.cos(angle),
                lng: center.lng + distance * Math.sin(angle)
            });
        }
        return experts;
    }

    private showNearbyExperts(pickupLocation: L.LatLng) {
        this.expertMarkers.forEach(marker => this.map?.removeLayer(marker));
        this.expertMarkers = [];
        const nearbyExperts = this.generateNearbyExperts(pickupLocation, 5);
        nearbyExperts.forEach(expert => {
            const expertIcon = L.divIcon({
                html: '<div style="font-size: 40px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🧑‍🔧</div>',
                className: 'expert-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });
            const marker = L.marker([expert.lat, expert.lng], { icon: expertIcon })
                .addTo(this.map!)
                .bindPopup(`<b>${expert.name}</b><br>Available now`);
            this.expertMarkers.push(marker);
        });
        const bounds = L.latLngBounds([pickupLocation]);
        nearbyExperts.forEach(expert => {
            bounds.extend([expert.lat, expert.lng]);
        });
        this.map?.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
    }

    private initMap(): void {
        this.map = L.map('bookingMap', {
            zoomControl: true
        }).setView([12.9716, 77.5946], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        this.map.on('click', async (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            try {
                const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
                const locationData = await this.http.get<any>(reverseGeoUrl).toPromise();
                const locationType = locationData?.type || '';
                const locationClass = locationData?.class || '';
                const displayName = locationData?.display_name?.toLowerCase() || '';
                const isWater = locationType === 'waterway' ||
                    locationClass === 'waterway' ||
                    locationClass === 'natural' && (locationType === 'water' || locationType === 'bay' || locationType === 'ocean') ||
                    displayName.includes('ocean') ||
                    displayName.includes('sea') ||
                    displayName.includes('bay');
                if (isWater) {
                    alert('⚠️ Cannot book expert in water! Please select a location on land.');
                    return;
                }
            } catch (error) {}

            if (this.pickupMarker) {
                this.map?.removeLayer(this.pickupMarker);
            }
            const pickupIcon = L.divIcon({
                html: '<div style="font-size: 32px;">📍</div>',
                className: 'custom-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            this.pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(this.map!);
            this.pickupAddress.set(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            this.showNearbyExperts(L.latLng(lat, lng));
            const fare: FareEstimate = { basefare: 245, total: 245 };
            this.fareEstimate.set(fare);
            this.showVehicleSelection.set(true);
        });
    }

    public ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['expertType']) {
                this.expertType.set(params['expertType']);
            }
        });
        this.initMap();
    }

    public ngOnDestroy(): void {
        if (this.map) {
            this.map.remove();
        }
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
    }
}
