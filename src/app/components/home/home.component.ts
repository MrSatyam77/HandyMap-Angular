import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent {
    public selectedExpert: string = '';

    constructor(private router: Router) { }

    public selectExpert(expertType: string): void {
        this.selectedExpert = expertType;
        this.onExpertSelect();
    }

    public onExpertSelect(): void {
        if (this.selectedExpert) {
            this.router.navigate(['/booking'], { 
                queryParams: { expertType: this.selectedExpert } 
            });
        }
    }
}
