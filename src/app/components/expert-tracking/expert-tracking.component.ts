import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
interface ExpertStatus {
    status: 'searching' | 'expert_assigned' | 'arriving' | 'in_progress' | 'completed';
    expertName?: string;
    expertPhone?: string;
    vehicleNumber?: string;
    rating?: number;
    eta?: number;
}
@Component({
    selector: 'app-expert-tracking',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './expert-tracking.component.html',
    styleUrls: ['./expert-tracking.component.scss']
})
export class ExpertTrackingComponent implements OnInit, OnDestroy {
    // Private variables
    private map?: L.Map;
    private expertMarker?: L.Marker;
    private pickupMarker?: L.Marker;
    private expertRouteLine?: L.Polyline;
    private simulationInterval?: any;
    private animationInterval?: any;
    private routePoints: L.LatLng[] = [];
    private currentRouteIndex = 0;

    // Public variables
    public expertStatus = signal<ExpertStatus>({ status: 'searching' });
    public totalFare = 245;
    public pickupLocation!: L.LatLng;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private http: HttpClient
    ) {
        this.route.queryParams.subscribe(params => {
            if (params['fare']) {
                this.totalFare = parseInt(params['fare']);
            }
            if (params['pickupLat'] && params['pickupLng']) {
                this.pickupLocation = L.latLng(
                    parseFloat(params['pickupLat']),
                    parseFloat(params['pickupLng'])
                );
            } else {
                this.pickupLocation = L.latLng(12.9716, 77.5946);
            }
        });
    }

    public cancelExpert(): void {
        if (confirm('Are you sure you want to cancel this expert?')) {
            this.router.navigate(['/home']);
        }
    }

    public goHome(): void {
        if (this.animationInterval) clearInterval(this.animationInterval);
        this.router.navigate(['/booking']);
    }

    private initMap(): void {
        this.map = L.map('trackingMap', { zoomControl: false }).setView([this.pickupLocation.lat, this.pickupLocation.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);
        const pickupIcon = L.divIcon({
            html: '<div style="font-size: 32px;">📍</div>',
            className: 'custom-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        this.pickupMarker = L.marker(this.pickupLocation, { icon: pickupIcon }).addTo(this.map);
        const expertStartLat = this.pickupLocation.lat - 0.05;
        const expertStartLng = this.pickupLocation.lng - 0.05;
        this.map.fitBounds(L.latLngBounds([
            this.pickupLocation,
            [expertStartLat, expertStartLng]
        ]), { padding: [50, 50] });
    }

    private simulateExpertFlow(): void {
        setTimeout(() => {
            const expertStart = L.latLng(
                this.pickupLocation.lat - 0.05,
                this.pickupLocation.lng - 0.05
            );
            const distance = this.map!.distance(expertStart, this.pickupLocation) / 1000;
            const averageSpeed = 40;
            const estimatedTimeMinutes = Math.ceil((distance / averageSpeed) * 60);
            this.expertStatus.set({
                status: 'expert_assigned',
                expertName: 'Rajesh Kumar',
                expertPhone: '+91 98765 43210',
                vehicleNumber: 'KA-01-AB-1234',
                rating: 4.8,
                eta: estimatedTimeMinutes
            });
            const expertIcon = L.divIcon({
                html: '<div style="font-size: 32px;">🧑‍🔧</div>',
                className: 'custom-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            this.expertMarker = L.marker(expertStart, { icon: expertIcon }).addTo(this.map!);
            this.fetchRoute(expertStart, this.pickupLocation).then(routePoints => {
                this.routePoints = routePoints;
                this.currentRouteIndex = 0;

                this.expertRouteLine = L.polyline(this.routePoints, {
                    color: '#2196F3',
                    weight: 4,
                    opacity: 0.8
                }).addTo(this.map!);
                this.animateExpertAlongRoute();
            });
        }, 2000);
    }

    private async fetchRoute(start: L.LatLng, end: L.LatLng): Promise<L.LatLng[]> {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
            const response = await this.http.get<any>(url).toPromise();
            if (response && response.routes && response.routes[0]) {
                const coordinates = response.routes[0].geometry.coordinates;
                return coordinates.map((coord: number[]) => L.latLng(coord[1], coord[0]));
            }
            return [start, end];
        } catch (error) {
            return this.generateFallbackRoute(start, end);
        }
    }

    private generateFallbackRoute(start: L.LatLng, end: L.LatLng): L.LatLng[] {
        const points: L.LatLng[] = [];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const lat = start.lat + (end.lat - start.lat) * t;
            const lng = start.lng + (end.lng - start.lng) * t;
            const curve1 = Math.sin(t * Math.PI * 2) * 0.0015;
            const curve2 = Math.sin(t * Math.PI * 3) * 0.001;
            const curvature = curve1 + curve2;
            points.push(L.latLng(lat + curvature, lng - curvature * 0.7));
        }
        return points;
    }

    private animateExpertAlongRoute() {
        if (this.animationInterval) clearInterval(this.animationInterval);
        this.currentRouteIndex = 0;
        const averageSpeed = 40; // km/h
        this.animationInterval = setInterval(() => {
            if (this.currentRouteIndex < this.routePoints.length) {
                const pos = this.routePoints[this.currentRouteIndex];
                if (this.expertMarker) {
                    this.expertMarker.setLatLng(pos);
                    if (this.map) this.map.panTo(pos, { animate: true, duration: 0.1 });
                }
                if (this.currentRouteIndex < this.routePoints.length - 1) {
                    let remainingDistance = 0;
                    for (let i = this.currentRouteIndex; i < this.routePoints.length - 1; i++) {
                        remainingDistance += this.map!.distance(
                            this.routePoints[i],
                            this.routePoints[i + 1]
                        );
                    }
                    const remainingKm = remainingDistance / 1000;
                    const etaMinutes = Math.ceil((remainingKm / averageSpeed) * 60);
                    this.expertStatus.update(s => ({
                        ...s,
                        eta: etaMinutes,
                        status: etaMinutes <= 1 ? 'arriving' : s.status
                    }));
                }
                this.currentRouteIndex++;
            } else {
                if (this.animationInterval) clearInterval(this.animationInterval);
                this.onExpertArrived();
            }
        }, 100);
    }

    private onExpertArrived() {
        const currentStatus = this.expertStatus().status;
        if (currentStatus === 'expert_assigned' || currentStatus === 'arriving') {
            setTimeout(() => {
                this.expertStatus.update(s => ({ ...s, status: 'completed' }));
                if (this.animationInterval) clearInterval(this.animationInterval);
            }, 500);
        }
    }

    public ngOnInit(): void {
        this.initMap();
        this.simulateExpertFlow();
    }

    public ngOnDestroy(): void {
        if (this.map) this.map.remove();
        if (this.simulationInterval) clearInterval(this.simulationInterval);
        if (this.animationInterval) clearInterval(this.animationInterval);
    }
}
