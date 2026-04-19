// ============================================
// ADMIN PANEL - Přihlášení & Správa receptů
// ============================================

// Stav editace
let editingRecipeId = null;

// Mapování uživatelského jména na email
const ADMIN_USERNAME_MAP = {
    'admin': 'admin@bezlepkove-recepty.cz',
    'Admin': 'admin@bezlepkove-recepty.cz'
};

// ============================================
// PŘIHLÁŠENÍ
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('login-form');
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const adminUserName = document.getElementById('admin-user-name');

    // Sledování stavu přihlášení
    auth.onAuthStateChanged(function (user) {
        if (user) {
            loginSection.style.display = 'none';
            adminPanel.style.display = 'block';
            adminUserName.textContent = 'Admin';
            loadAdminRecipes();
        } else {
            loginSection.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    });

    // Přihlášení
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const email = ADMIN_USERNAME_MAP[username];
        if (!email) {
            showLoginError('Nesprávné uživatelské jméno!');
            return;
        }

        // Animace tlačítka
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<span class="spinner"></span> Přihlašuji...';
        submitBtn.disabled = true;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginError.style.display = 'none';
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showLoginError('Nesprávné heslo!');
            } else if (error.code === 'auth/user-not-found') {
                showLoginError('Uživatel nenalezen! Vytvoř ho ve Firebase Console.');
            } else {
                showLoginError('Chyba přihlášení: ' + error.message);
            }
        } finally {
            submitBtn.innerHTML = '🔓 Přihlásit se';
            submitBtn.disabled = false;
        }
    });

    // Odhlášení
    logoutBtn.addEventListener('click', function () {
        auth.signOut();
    });

    // Formulář nového receptu
    const recipeForm = document.getElementById('recipe-form');
    recipeForm.addEventListener('submit', handleRecipeSubmit);

    // Přidání skupiny ingrediencí
    document.getElementById('add-ingredient-group').addEventListener('click', addIngredientGroup);

    // Přidání kroku přípravy
    document.getElementById('add-step').addEventListener('click', addStep);

    // Přidání tipu
    document.getElementById('add-tip').addEventListener('click', addTip);
});

function showLoginError(message) {
    const loginError = document.getElementById('login-error');
    loginError.textContent = message;
    loginError.style.display = 'block';
    loginError.style.animation = 'shake 0.5s ease';
    setTimeout(() => loginError.style.animation = '', 500);
}

// ============================================
// PŘIDÁNÍ / ÚPRAVA RECEPTU
// ============================================

async function handleRecipeSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const isEditing = !!editingRecipeId;
    submitBtn.innerHTML = '<span class="spinner"></span> Ukládám recept...';
    submitBtn.disabled = true;

    try {
        const name = document.getElementById('recipe-name').value.trim();
        const description = document.getElementById('recipe-description').value.trim();
        const prepTime = document.getElementById('recipe-prep-time').value.trim();
        const cookTime = document.getElementById('recipe-cook-time').value.trim();
        const servings = document.getElementById('recipe-servings').value.trim();
        const notes = document.getElementById('recipe-notes').value.trim();

        // Ingredience – skupiny
        const ingredientGroups = [];
        document.querySelectorAll('.ingredient-group').forEach(group => {
            const groupName = group.querySelector('.ingredient-group-name').value.trim();
            const groupItems = group.querySelector('.ingredient-group-items').value.trim();
            if (groupName && groupItems) {
                ingredientGroups.push({
                    name: groupName,
                    items: groupItems.split('\n').filter(item => item.trim() !== '')
                });
            }
        });

        // Postup
        const steps = [];
        document.querySelectorAll('.step-input').forEach(input => {
            const val = input.value.trim();
            if (val) steps.push(val);
        });

        // Tipy
        const tips = [];
        document.querySelectorAll('.tip-input').forEach(input => {
            const val = input.value.trim();
            if (val) tips.push(val);
        });

        // Obrázek – komprimovat a uložit jako base64
        let imageUrl = '';
        const imageFile = document.getElementById('recipe-image').files[0];
        if (imageFile) {
            imageUrl = await compressImage(imageFile);
        }

        if (isEditing) {
            // EDITACE – aktualizace existujícího receptu
            const recipeData = {
                name,
                description,
                prepTime,
                cookTime,
                servings,
                ingredientGroups,
                steps,
                tips,
                notes,
                slug: createSlug(name),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Obrázek aktualizovat jen pokud byl nahrán nový
            if (imageUrl) {
                recipeData.imageUrl = imageUrl;
            }

            await db.collection('recipes').doc(editingRecipeId).update(recipeData);

            // Reset editace
            cancelEdit();

            showNotification('✅ Recept úspěšně upraven!', 'success');
        } else {
            // NOVÝ RECEPT
            const recipeData = {
                name,
                description,
                prepTime,
                cookTime,
                servings,
                ingredientGroups,
                steps,
                tips,
                notes,
                imageUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                slug: createSlug(name)
            };

            await db.collection('recipes').add(recipeData);

            // Reset formuláře
            e.target.reset();
            resetDynamicFields();

            showNotification('✅ Recept úspěšně přidán!', 'success');
        }

        loadAdminRecipes();

    } catch (error) {
        console.error('Error saving recipe:', error);
        showNotification('❌ Chyba při ukládání: ' + error.message, 'error');
    } finally {
        if (editingRecipeId) {
            submitBtn.innerHTML = '💾 Uložit změny';
        } else {
            submitBtn.innerHTML = '✨ Přidat recept';
        }
        submitBtn.disabled = false;
    }
}

// ============================================
// EDITACE RECEPTU
// ============================================

async function editRecipe(id) {
    try {
        const doc = await db.collection('recipes').doc(id).get();
        if (!doc.exists) {
            showNotification('❌ Recept nenalezen!', 'error');
            return;
        }

        const recipe = doc.data();
        editingRecipeId = id;

        // Přepnout na tab nového receptu (který se změní na editaci)
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById('tab-new-recipe').classList.add('active');
        document.querySelectorAll('.admin-tab')[0].classList.add('active');

        // Změnit nadpis tabu a formuláře
        const formTitle = document.querySelector('#tab-new-recipe .form-section-title');
        if (formTitle) formTitle.innerHTML = '✏️ Upravit recept';

        // Zobrazit banner editace
        showEditBanner(recipe.name);

        // Vyplnit základní info
        document.getElementById('recipe-name').value = recipe.name || '';
        document.getElementById('recipe-description').value = recipe.description || '';
        document.getElementById('recipe-prep-time').value = recipe.prepTime || '';
        document.getElementById('recipe-cook-time').value = recipe.cookTime || '';
        document.getElementById('recipe-servings').value = recipe.servings || '';
        document.getElementById('recipe-notes').value = recipe.notes || '';

        // Zobrazit existující obrázek v preview
        const preview = document.getElementById('image-preview');
        if (recipe.imageUrl) {
            preview.innerHTML = `<img src="${recipe.imageUrl}" class="image-preview-img">`;
        } else {
            preview.innerHTML = '';
        }

        // Vyplnit ingredience
        const ingredientContainer = document.getElementById('ingredient-groups');
        ingredientContainer.innerHTML = '';
        if (recipe.ingredientGroups && recipe.ingredientGroups.length > 0) {
            recipe.ingredientGroups.forEach((group, index) => {
                const groupEl = document.createElement('div');
                groupEl.className = 'ingredient-group';
                groupEl.innerHTML = `
                    <div class="dynamic-field-header">
                        <span>Skupina ${index + 1}</span>
                        <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
                    </div>
                    <input type="text" class="ingredient-group-name admin-input" placeholder="Název skupiny (např. Na těsto)" value="${escapeHtml(group.name)}">
                    <textarea class="ingredient-group-items admin-input" rows="4" placeholder="Ingredience (každá na nový řádek)">${escapeHtml(group.items.join('\n'))}</textarea>
                `;
                ingredientContainer.appendChild(groupEl);
            });
        } else {
            addIngredientGroup();
        }

        // Vyplnit kroky
        const stepsContainer = document.getElementById('steps-container');
        stepsContainer.innerHTML = '';
        if (recipe.steps && recipe.steps.length > 0) {
            recipe.steps.forEach((step, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'step-wrapper';
                wrapper.innerHTML = `
                    <div class="dynamic-field-header">
                        <span>Krok ${index + 1}</span>
                        <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
                    </div>
                    <textarea class="step-input admin-input" rows="2" placeholder="Popište tento krok přípravy...">${escapeHtml(step)}</textarea>
                `;
                stepsContainer.appendChild(wrapper);
            });
        } else {
            addStep();
        }

        // Vyplnit tipy
        const tipsContainer = document.getElementById('tips-container');
        tipsContainer.innerHTML = '';
        if (recipe.tips && recipe.tips.length > 0) {
            recipe.tips.forEach(tip => {
                const wrapper = document.createElement('div');
                wrapper.className = 'tip-wrapper';
                wrapper.innerHTML = `
                    <div class="dynamic-field-header">
                        <span>Tip</span>
                        <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
                    </div>
                    <input type="text" class="tip-input admin-input" placeholder="Napište tip nebo trik..." value="${escapeHtml(tip)}">
                `;
                tipsContainer.appendChild(wrapper);
            });
        } else {
            addTip();
        }

        // Změnit tlačítko submit
        const submitBtn = document.querySelector('#recipe-form button[type="submit"]');
        submitBtn.innerHTML = '💾 Uložit změny';

        // Scroll nahoru ke formuláři
        document.getElementById('tab-new-recipe').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error loading recipe for edit:', error);
        showNotification('❌ Chyba při načítání receptu: ' + error.message, 'error');
    }
}

function cancelEdit() {
    editingRecipeId = null;

    // Vrátit nadpis
    const formTitle = document.querySelector('#tab-new-recipe .form-section-title');
    if (formTitle) formTitle.innerHTML = '📸 Základní info';

    // Odstranit banner editace
    const banner = document.getElementById('edit-banner');
    if (banner) banner.remove();

    // Reset formuláře
    document.getElementById('recipe-form').reset();
    resetDynamicFields();

    // Vrátit tlačítko
    const submitBtn = document.querySelector('#recipe-form button[type="submit"]');
    submitBtn.innerHTML = '✨ Přidat recept';
}

function showEditBanner(recipeName) {
    // Odstranit existující banner
    const existing = document.getElementById('edit-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'edit-banner';
    banner.className = 'edit-banner';
    banner.innerHTML = `
        <div class="edit-banner-info">
            <span class="edit-banner-icon">✏️</span>
            <span>Upravuješ: <strong>${recipeName}</strong></span>
        </div>
        <button type="button" class="edit-banner-cancel" onclick="cancelEdit()">✕ Zrušit úpravy</button>
    `;

    const form = document.getElementById('recipe-form');
    form.insertBefore(banner, form.firstChild);
    banner.style.animation = 'slideIn 0.3s ease';
}

// Pomocná funkce pro escapování HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Komprimace obrázku a převod na base64 (ukládá se přímo do Firestore)
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                // Zmenšit proporcionálně
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                if (height > MAX_HEIGHT) {
                    width = Math.round((width * MAX_HEIGHT) / height);
                    height = MAX_HEIGHT;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Komprimovat jako JPEG s kvalitou 0.6
                const base64 = canvas.toDataURL('image/jpeg', 0.6);
                resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Vytvoření slug z názvu
function createSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ============================================
// DYNAMICKÉ POLE FORMULÁŘE
// ============================================

function addIngredientGroup() {
    const container = document.getElementById('ingredient-groups');
    const groupCount = container.querySelectorAll('.ingredient-group').length + 1;

    const group = document.createElement('div');
    group.className = 'ingredient-group';
    group.innerHTML = `
        <div class="dynamic-field-header">
            <span>Skupina ${groupCount}</span>
            <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <input type="text" class="ingredient-group-name admin-input" placeholder="Název skupiny (např. Na těsto)">
        <textarea class="ingredient-group-items admin-input" rows="4" placeholder="Ingredience (každá na nový řádek)&#10;Např:&#10;200g bezlepková mouka&#10;100g máslo&#10;2 vejce"></textarea>
    `;
    container.appendChild(group);
    group.style.animation = 'slideIn 0.3s ease';
}

function addStep() {
    const container = document.getElementById('steps-container');
    const stepCount = container.querySelectorAll('.step-input').length + 1;

    const wrapper = document.createElement('div');
    wrapper.className = 'step-wrapper';
    wrapper.innerHTML = `
        <div class="dynamic-field-header">
            <span>Krok ${stepCount}</span>
            <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <textarea class="step-input admin-input" rows="2" placeholder="Popište tento krok přípravy..."></textarea>
    `;
    container.appendChild(wrapper);
    wrapper.style.animation = 'slideIn 0.3s ease';
}

function addTip() {
    const container = document.getElementById('tips-container');

    const wrapper = document.createElement('div');
    wrapper.className = 'tip-wrapper';
    wrapper.innerHTML = `
        <div class="dynamic-field-header">
            <span>Tip</span>
            <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <input type="text" class="tip-input admin-input" placeholder="Napište tip nebo trik...">
    `;
    container.appendChild(wrapper);
    wrapper.style.animation = 'slideIn 0.3s ease';
}

function resetDynamicFields() {
    // Reset ingredient groups - keep just one
    const ingredientContainer = document.getElementById('ingredient-groups');
    ingredientContainer.innerHTML = '';
    addIngredientGroup();

    // Reset steps - keep just one
    const stepsContainer = document.getElementById('steps-container');
    stepsContainer.innerHTML = '';
    addStep();

    // Reset tips - keep just one
    const tipsContainer = document.getElementById('tips-container');
    tipsContainer.innerHTML = '';
    addTip();

    // Reset image preview
    const preview = document.getElementById('image-preview');
    if (preview) preview.innerHTML = '';
}

// ============================================
// SPRÁVA RECEPTŮ (ADMIN)
// ============================================

async function loadAdminRecipes() {
    const container = document.getElementById('admin-recipes-list');
    container.innerHTML = '<p class="loading-text"><span class="spinner"></span> Načítám recepty...</p>';

    try {
        const snapshot = await db.collection('recipes').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="empty-text">Zatím žádné recepty. Přidej svůj první! 🍰</p>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const recipe = doc.data();
            const card = document.createElement('div');
            card.className = 'admin-recipe-card';
            card.innerHTML = `
                <div class="admin-recipe-info">
                    ${recipe.imageUrl ? `<img src="${recipe.imageUrl}" alt="${recipe.name}" class="admin-recipe-thumb">` : '<div class="admin-recipe-thumb-placeholder">📷</div>'}
                    <div>
                        <h4>${recipe.name}</h4>
                        <p>${recipe.description || 'Bez popisu'}</p>
                    </div>
                </div>
                <div class="admin-recipe-actions">
                    <a href="recept.html?id=${doc.id}" class="admin-btn admin-btn-view" target="_blank">👁️ Zobrazit</a>
                    <button class="admin-btn admin-btn-edit" onclick="editRecipe('${doc.id}')">✏️ Upravit</button>
                    <button class="admin-btn admin-btn-delete" onclick="deleteRecipe('${doc.id}')">🗑️ Smazat</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = `<p class="error-text">❌ Chyba při načítání: ${error.message}</p>`;
    }
}

async function deleteRecipe(id) {
    if (!confirm('Opravdu chceš smazat tento recept?')) return;

    try {
        // Smazat recept z Firestore
        await db.collection('recipes').doc(id).delete();

        showNotification('🗑️ Recept smazán!', 'success');
        loadAdminRecipes();
    } catch (error) {
        showNotification('❌ Chyba při mazání: ' + error.message, 'error');
    }
}

// ============================================
// NOTIFIKACE
// ============================================

function showNotification(message, type) {
    // Odstranit existující notifikace
    const existing = document.querySelector('.admin-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ============================================
// NÁHLED OBRÁZKU
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    const imageInput = document.getElementById('recipe-image');
    if (imageInput) {
        imageInput.addEventListener('change', function () {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = '';

            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'image-preview-img';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});
