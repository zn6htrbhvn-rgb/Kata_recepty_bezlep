// ============================================
// NAČÍTÁNÍ RECEPTŮ Z FIREBASE
// ============================================
// Tento skript načítá recepty z Firebase Firestore
// a zobrazuje je na stránkách recepty.html a index.html

async function loadFirebaseRecipes(containerId, limit = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        let query = db.collection('recipes').orderBy('createdAt', 'desc');
        if (limit) {
            query = query.limit(limit);
        }

        const snapshot = await query.get();

        if (snapshot.empty) return;

        snapshot.forEach(doc => {
            const recipe = doc.data();
            const card = document.createElement('a');
            card.href = `recept.html?id=${doc.id}`;
            card.className = 'recipe-preview-card firebase-recipe';
            card.innerHTML = `
                <div class="recipe-image">
                    ${recipe.imageUrl 
                        ? `<img src="${recipe.imageUrl}" alt="${recipe.name}">` 
                        : `<div class="recipe-image-placeholder">
                            <span>🍽️</span>
                           </div>`
                    }
                </div>
                <h3>${recipe.name}</h3>
                <p>${recipe.description || 'Bezlepkový recept'}</p>
            `;

            // Animace
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

            container.appendChild(card);

            // Trigger animace
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100);
        });
    } catch (error) {
        console.warn('Firebase recepty se nepodařilo načíst:', error.message);
    }
}

// Automatické načtení na příslušných stránkách
document.addEventListener('DOMContentLoaded', function () {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (currentPage === 'recepty.html') {
        loadFirebaseRecipes('firebase-recipes-grid');
    }

    if (currentPage === 'index.html' || currentPage === '') {
        loadFirebaseRecipes('firebase-homepage-recipes', 3);
    }
});
