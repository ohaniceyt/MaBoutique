const app = {
    data: JSON.parse(localStorage.getItem('maboutique_pro_v4')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: []
    },

    save() {
        localStorage.setItem('maboutique_pro_v4', JSON.stringify(this.data));
        this.render();
    },

    finishOnboarding() {
        const name = document.getElementById('ob-name').value.trim();
        const shop = document.getElementById('ob-shop').value.trim();
        if(name && shop) {
            this.data.profile = { name };
            this.data.shops.push({ name: shop, inventory: [], debts: [], team: [name] });
            this.save();
            document.getElementById('onboarding').classList.remove('active');
        }
    },

    logic: {
        updateStock(idx, delta) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const item = shop.inventory[idx];
            if(delta < 0) {
                const price = prompt(`Prix de vente pour ${item.name} ?`);
                if(price && !isNaN(price)) {
                    app.data.logs.push({ type: 'VENTE', val: parseInt(price), desc: item.name, time: new Date().toLocaleTimeString() });
                    item.qty = Math.max(0, item.qty - 1);
                }
            } else { item.qty += 1; }
            app.save();
        },
        addAcompte(idx) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const d = shop.debts[idx];
            const val = prompt(`Acompte de ${d.client} ?`);
            if(val) {
                const amount = parseInt(val);
                d.paid += amount;
                app.data.logs.push({ type: 'ACOMPTE', val: amount, desc: d.client, time: new Date().toLocaleTimeString() });
                if(d.paid >= d.total) shop.debts.splice(idx, 1);
                app.save();
            }
        },
        clearReport() { if(confirm("Vider le bilan ?")) { app.data.logs = []; app.save(); } }
    },

    ui: {
        switchTab(tabId) {
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`view-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active', 'text-gray-500'));
            document.getElementById(`btn-${tabId}`).classList.add('tab-active');
        },
        openShopMenu() {
            this.renderShopList();
            document.getElementById('modal-shops').classList.add('active');
        },
        closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); },
        renderShopList() {
            const container = document.getElementById('shop-list-container');
            container.innerHTML = app.data.shops.map((s, idx) => `
                <div class="flex gap-2">
                    <div onclick="app.ui.switchShop(${idx})" class="flex-1 p-4 rounded-2xl border-2 ${idx === app.data.activeShopIdx ? 'border-green-600 bg-green-50 text-green-700' : 'bg-gray-50'} font-bold cursor-pointer text-left">
                        ${s.name}
                    </div>
                    <button onclick="app.ui.deleteShop(${idx})" class="p-4 bg-red-50 text-red-500 rounded-2xl text-left">🗑️</button>
                </div>
            `).join('');
        },
        switchShop(idx) { app.data.activeShopIdx = idx; app.save(); this.closeModals(); },
        promptNewShop() {
            const n = prompt("Nom de la boutique :");
            if(n) { app.data.shops.push({ name: n, inventory: [], debts: [], team: [app.data.profile.name] }); app.save(); }
        },
        deleteShop(idx) {
            if(app.data.shops.length > 1 && confirm("Supprimer cette boutique ?")) {
                app.data.shops.splice(idx, 1);
                app.data.activeShopIdx = 0;
                app.save();
            }
        },
        addProduct() { const n = prompt("Nom produit :"); if(n) { app.data.shops[app.data.activeShopIdx].inventory.push({name:n, qty:0}); app.save(); } },
        addDebt() { 
            const c = prompt("Client :"), t = prompt("Total :");
            if(c && t) { app.data.shops[app.data.activeShopIdx].debts.push({client:c, total:parseInt(t), paid:0}); app.save(); }
        }
    },

    render() {
        if(!this.data.profile) return document.getElementById('onboarding').classList.add('active');
        const shop = this.data.shops[this.data.activeShopIdx];
        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.data.profile.name;

        // Stock
        const sv = document.getElementById('view-stock');
        sv.innerHTML = shop.inventory.map((item, i) => `
            <div class="bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm">
                <div class="text-left"><p class="font-extrabold text-gray-800">${item.name}</p><p class="text-xs font-bold text-gray-400 uppercase">${item.qty} EN STOCK</p></div>
                <div class="flex gap-2"><button onclick="app.logic.updateStock(${i},-1)" class="w-12 h-12 bg-gray-50 rounded-2xl font-black">-</button><button onclick="app.logic.updateStock(${i},1)" class="w-12 h-12 bg-green-50 text-green-600 rounded-2xl font-black">+</button></div>
            </div>`).join('') || '<p class="text-center py-10 text-gray-400">Vide</p>';

        // Dettes
        const dv = document.getElementById('view-dettes');
        dv.innerHTML = shop.debts.map((d, i) => `
            <div class="bg-white p-6 rounded-[2rem] border-l-8 border-blue-600 shadow-sm text-left">
                <div class="flex justify-between mb-4"><div><p class="font-black">${d.client}</p><p class="text-[10px] text-gray-400 font-bold uppercase">Initial: ${d.total} CFA</p></div><p class="text-2xl font-black text-blue-700">${d.total-d.paid}</p></div>
                <button onclick="app.logic.addAcompte(${i})" class="w-full py-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase">Encaisser</button>
            </div>`).join('') || '<p class="text-center py-10 text-gray-400">Aucune dette</p>';

        // Rapport
        let tS = 0, tC = 0;
        document.getElementById('rep-log').innerHTML = this.data.logs.map(l => {
            if(l.type === 'VENTE') tS += l.val; else tC += l.val;
            return `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                <div class="text-left"><p class="text-[9px] font-black ${l.type === 'VENTE' ? 'text-green-500' : 'text-blue-500'}">${l.type}</p><p class="font-bold text-xs">${l.desc}</p></div>
                <div class="text-right"><p class="font-black text-xs">${l.val} CFA</p></div>
            </div>`;
        }).join('');
        document.getElementById('rep-sales').innerText = tS + " CFA";
        document.getElementById('rep-cash').innerText = tC + " CFA";

        // Team
        document.getElementById('team-list').innerHTML = `<h3 class="font-extrabold text-left">Équipe</h3>` + shop.team.map(m => `<div class="p-4 bg-gray-50 rounded-2xl font-bold text-gray-600 text-left">👤 ${m}</div>`).join('');
    }
};

app.render();

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
