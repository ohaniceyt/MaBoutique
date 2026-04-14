const app = {
    // Clé de version v6 pour éviter les conflits
    data: JSON.parse(localStorage.getItem('maboutique_ultra_v6')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: [],
        expenses: []
    },

    save() {
        localStorage.setItem('maboutique_ultra_v6', JSON.stringify(this.data));
        this.render();
    },

    logic: {
        updateStock(idx, delta) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const item = shop.inventory[idx];
            if (delta < 0) {
                const price = prompt(`Prix de vente pour ${item.name} ? (CFA)`);
                if (price && !isNaN(price)) {
                    const profit = item.buyPrice ? (parseInt(price) - item.buyPrice) : 0;
                    app.data.logs.push({
                        type: 'VENTE',
                        val: parseInt(price),
                        gain: profit,
                        desc: item.name,
                        time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
                    });
                    item.qty = Math.max(0, item.qty - 1);
                }
            } else {
                item.qty += 1;
            }
            app.save();
        },

        addAcompte(idx) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const d = shop.debts[idx];
            const val = prompt(`Acompte de ${d.client} ? (CFA)`);
            if (val && !isNaN(val)) {
                const amount = parseInt(val);
                d.paid += amount;
                app.data.logs.push({ type: 'ACOMPTE', val: amount, gain: 0, desc: `Acompte: ${d.client}`, time: new Date().toLocaleTimeString() });
                
                if (confirm("Envoyer un reçu WhatsApp au client ?")) {
                    const msg = `*REÇU ${shop.name}*\nMerci ${d.client}.\nAcompte : ${amount} CFA.\n*RESTE : ${d.total - d.paid} CFA*`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
                }

                if (d.paid >= d.total) shop.debts.splice(idx, 1);
                app.save();
            }
        },

        shareReport() {
            let tin = 0, tout = 0, tgain = 0;
            app.data.logs.forEach(l => { tin += l.val; tgain += l.gain; });
            app.data.expenses.forEach(e => tout += e.val);
            const shop = app.data.shops[app.data.activeShopIdx];
            const msg = `*BILAN ${shop.name.toUpperCase()}*\n---\n✅ ENTRÉES : ${tin} CFA\n💸 DÉPENSES : ${tout} CFA\n📈 BÉNÉFICE NET : ${tgain - tout} CFA\n---\n💰 *SOLDE EN CAISSE : ${tin - tout} CFA*`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        },

        clearReport() {
            if (confirm("Voulez-vous clôturer la journée et vider le bilan ?")) {
                app.data.logs = [];
                app.data.expenses = [];
                app.save();
            }
        }
    },

    ui: {
        switchTab(tabId) {
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`view-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active', 'text-gray-500'));
            document.getElementById(`btn-${tabId}`).classList.add('tab-active');
        },

        openShopMenu() {
            const container = document.getElementById('shop-list-container');
            container.innerHTML = app.data.shops.map((s, idx) => `
                <div class="flex gap-2">
                    <button onclick="app.ui.switchShop(${idx})" class="flex-1 p-4 rounded-2xl border-2 text-left font-bold ${idx === app.data.activeShopIdx ? 'border-green-600 bg-green-50 text-green-700' : 'bg-gray-50 border-transparent'}">
                        ${s.name}
                    </button>
                    <button onclick="app.ui.deleteShop(${idx})" class="p-4 bg-red-50 text-red-500 rounded-2xl">🗑️</button>
                </div>
            `).join('');
            document.getElementById('modal-shops').classList.add('active');
        },

        switchShop(idx) {
            app.data.activeShopIdx = idx;
            document.getElementById('modal-shops').classList.remove('active');
            app.save();
        },

        deleteShop(idx) {
            if (app.data.shops.length <= 1) return alert("Gardez au moins une boutique !");
            if (confirm("Supprimer cette boutique et ses données ?")) {
                app.data.shops.splice(idx, 1);
                app.data.activeShopIdx = 0;
                app.ui.openShopMenu();
                app.save();
            }
        },

        promptNewShop() {
            const n = prompt("Nom de la boutique ?");
            if (n) {
                app.data.shops.push({ name: n, inventory: [], debts: [] });
                app.data.activeShopIdx = app.data.shops.length - 1;
                app.save();
                document.getElementById('modal-shops').classList.remove('active');
            }
        },

        startScan() {
            document.getElementById('modal-scan').classList.add('active');
            const scanner = new Html5Qrcode("reader");
            scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
                (code) => {
                    const shop = app.data.shops[app.data.activeShopIdx];
                    const idx = shop.inventory.findIndex(i => i.barcode === code);
                    app.ui.stopScan(scanner);
                    if (idx !== -1) {
                        app.logic.updateStock(idx, -1);
                    } else {
                        if (confirm("Nouveau code-barres. Lier à un produit ?")) {
                            const name = prompt("Nom du produit ?");
                            const buy = prompt("Prix d'achat ?");
                            shop.inventory.push({ name, qty: 1, barcode: code, buyPrice: parseInt(buy)||0 });
                            app.save();
                        }
                    }
                }
            ).catch(() => alert("Erreur Caméra. Vérifiez HTTPS."));
            window.activeScanner = scanner;
        },

        stopScan(scannerInstance) {
            const s = scannerInstance || window.activeScanner;
            if (s) s.stop();
            document.getElementById('modal-scan').classList.remove('active');
        },

        addProduct() {
            const name = prompt("Nom du produit ?");
            const buy = prompt("Prix d'achat (CFA) ?");
            if (name) {
                app.data.shops[app.data.activeShopIdx].inventory.push({ name, qty: 0, buyPrice: parseInt(buy)||0 });
                app.save();
            }
        },

        addDebt() {
            const client = prompt("Nom du client ?"), total = prompt("Montant Dette ?");
            if (client && total) {
                app.data.shops[app.data.activeShopIdx].debts.push({ client, total: parseInt(total), paid: 0 });
                app.save();
            }
        },

        addExpense() {
            const desc = prompt("Motif de la dépense ?"), val = prompt("Montant ?");
            if (desc && val) {
                app.data.expenses.push({ desc, val: parseInt(val), time: new Date().toLocaleTimeString() });
                app.save();
            }
        }
    },

    render() {
        if (!this.data.profile) {
            const n = prompt("Votre Nom ?"), s = prompt("Nom de votre Boutique ?");
            if (n && s) { 
                this.data.profile = { name: n }; 
                this.data.shops.push({ name: s, inventory: [], debts: [] }); 
                this.save(); 
            }
            return;
        }

        const shop = this.data.shops[this.data.activeShopIdx];
        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.data.profile.name;

        // Render STOCK
        document.getElementById('view-stock').innerHTML = shop.inventory.map((item, i) => `
            <div class="bg-white p-5 rounded-3xl shadow-sm flex justify-between items-center border border-white">
                <div class="text-left"><p class="font-black text-gray-800">${item.name}</p>
                <p class="text-[10px] font-black tracking-widest ${item.qty < 5 ? 'text-red-500':'text-gray-400'} uppercase">${item.qty} EN STOCK</p></div>
                <div class="flex gap-2">
                    <button onclick="app.logic.updateStock(${i},-1)" class="w-12 h-12 bg-gray-50 rounded-2xl font-black active:bg-red-50">-</button>
                    <button onclick="app.logic.updateStock(${i},1)" class="w-12 h-12 bg-green-50 text-green-700 rounded-2xl font-black active:bg-green-100">+</button>
                </div>
            </div>`).join('') || '<p class="text-center py-20 text-gray-400 font-bold tracking-tighter italic">Aucun produit en stock</p>';

        // Render DETTES
        document.getElementById('view-dettes').innerHTML = shop.debts.map((d, i) => `
            <div class="bg-white p-6 rounded-[2.5rem] border-l-8 border-blue-600 shadow-sm text-left">
                <div class="flex justify-between items-start mb-4">
                    <div><p class="font-black text-lg">${d.client}</p><p class="text-[10px] text-gray-400 font-bold uppercase">Total: ${d.total} CFA</p></div>
                    <div class="text-right font-black text-blue-700 text-2xl">${d.total-d.paid}</div>
                </div>
                <div class="w-full bg-gray-100 h-1.5 rounded-full mb-5"><div class="bg-blue-600 h-full rounded-full transition-all" style="width: ${(d.paid/d.total)*100}%"></div></div>
                <button onclick="app.logic.addAcompte(${i})" class="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100 active:bg-blue-100">Encaisser Acompte</button>
            </div>`).join('') || '<p class="text-center py-20 text-gray-400 font-bold">Zéro dette.</p>';

        // Render BILAN
        let tin = 0, tout = 0, tgain = 0;
        const logHtml = app.data.logs.map(l => {
            tin += l.val; tgain += l.gain;
            return `<div class="flex justify-between p-3 bg-green-50/50 rounded-2xl text-[11px] font-bold"><span>${l.type} : ${l.desc}</span><span class="font-black">+${l.val}</span></div>`;
        }).join('') + app.data.expenses.map(e => {
            tout += e.val;
            return `<div class="flex justify-between p-3 bg-red-50/50 rounded-2xl text-[11px] font-bold text-red-700"><span>DÉPENSE : ${e.desc}</span><span class="font-black">-${e.val}</span></div>`;
        }).join('');

        document.getElementById('rep-in').innerText = tin + " CFA";
        document.getElementById('rep-out').innerText = tout + " CFA";
        document.getElementById('rep-gain').innerText = (tgain - tout) + " CFA";
        document.getElementById('rep-log').innerHTML = logHtml || '<p class="text-center text-gray-400 py-4 italic">Aucun mouvement aujourd\'hui</p>';
    }
};

app.render();
