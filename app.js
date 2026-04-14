const app = {
    data: JSON.parse(localStorage.getItem('maboutique_ultra_v7')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: [],
        expenses: []
    },

    save() {
        localStorage.setItem('maboutique_ultra_v7', JSON.stringify(this.data));
        this.render();
    },

    logic: {
        // Vente avec prix ajustable
        sellItem(idx) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const item = shop.inventory[idx];
            const price = prompt(`Vendre "${item.name}" (Code: ${item.barcode}) \nEntrez le prix final (CFA):`, item.price || 0);
            
            if (price !== null && !isNaN(price)) {
                const profit = item.buyPrice ? (parseInt(price) - item.buyPrice) : 0;
                app.data.logs.push({
                    type: 'VENTE',
                    val: parseInt(price),
                    gain: profit,
                    desc: item.name,
                    time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
                });
                item.qty = Math.max(0, item.qty - 1);
                app.save();
            }
        },

        shareReport() {
            let tin = 0, tout = 0, tgain = 0;
            app.data.logs.forEach(l => { tin += l.val; tgain += l.gain; });
            app.data.expenses.forEach(e => tout += e.val);
            const shop = app.data.shops[app.data.activeShopIdx];
            const msg = `*BILAN ${shop.name.toUpperCase()}*\n---\n✅ ENTRÉES : ${tin} CFA\n💸 DÉPENSES : ${tout} CFA\n📈 BÉNÉFICE : ${tgain - tout} CFA\n---\n💰 *SOLDE : ${tin - tout} CFA*`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        },

        clearReport() {
            if (confirm("Vider le bilan du jour ?")) { app.data.logs = []; app.data.expenses = []; app.save(); }
        }
    },

    ui: {
        switchTab(tabId) {
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`view-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active', 'text-gray-500'));
            document.getElementById(`btn-${tabId}`).classList.add('tab-active');
        },

        filterStock() { this.render(); },

        startScan(mode = 'vente') {
            document.getElementById('modal-scan').classList.add('active');
            const scanner = new Html5Qrcode("reader");
            scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
                (code) => {
                    const shop = app.data.shops[app.data.activeShopIdx];
                    const idx = shop.inventory.findIndex(i => i.barcode === code);
                    app.ui.stopScan(scanner);

                    if (idx !== -1) {
                        if (mode === 'vente') {
                            app.logic.sellItem(idx);
                        } else {
                            const newQty = prompt(`Mettre à jour le stock de "${shop.inventory[idx].name}" :`, shop.inventory[idx].qty);
                            if (newQty !== null) { shop.inventory[idx].qty = parseInt(newQty); app.save(); }
                        }
                    } else {
                        if(confirm("Code inconnu. Créer ce produit ?")) { this.addProduct(code); }
                    }
                }
            ).catch(err => alert("Erreur caméra : Vérifiez HTTPS"));
            window.activeScanner = scanner;
        },

        stopScan(scannerInstance) {
            const s = scannerInstance || window.activeScanner;
            if (s) s.stop();
            document.getElementById('modal-scan').classList.remove('active');
        },

        addProduct(scannedCode = null) {
            const name = prompt("Nom du produit ?");
            if (!name) return;
            const barcode = scannedCode || prompt("Scanner le code ou laisser vide pour ID AUTO :") || "STK-" + Date.now().toString().slice(-4);
            const price = prompt("Prix de vente par défaut (CFA) :");
            const buy = prompt("Prix d'achat (CFA) :");
            
            app.data.shops[app.data.activeShopIdx].inventory.push({ 
                name, qty: 0, barcode, price: parseInt(price)||0, buyPrice: parseInt(buy)||0 
            });
            app.save();
        },

        addDebt() {
            const c = prompt("Nom du client ?"), t = prompt("Montant Dette ?");
            if (c && t) { app.data.shops[app.data.activeShopIdx].debts.push({ client: c, total: parseInt(t), paid: 0 }); app.save(); }
        },

        addExpense() {
            const d = prompt("Motif ?"), v = prompt("Montant ?");
            if (d && v) { app.data.expenses.push({ desc: d, val: parseInt(v), time: new Date().toLocaleTimeString() }); app.save(); }
        }
    },

    render() {
        if (!this.data.profile) {
            const n = prompt("Votre Nom ?"), s = prompt("Votre Boutique ?");
            if (n && s) { this.data.profile = { name: n }; this.data.shops.push({ name: s, inventory: [], debts: [] }); this.save(); }
            return;
        }

        const shop = this.data.shops[this.data.activeShopIdx];
        const query = document.getElementById('stock-search')?.value.toLowerCase() || "";
        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.data.profile.name;

        // Render STOCK Filtré
        const filtered = shop.inventory.filter(i => i.name.toLowerCase().includes(query) || i.barcode.toLowerCase().includes(query));
        document.getElementById('inventory-list').innerHTML = filtered.map((item) => {
            const realIdx = shop.inventory.indexOf(item);
            return `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div class="text-left">
                        <p class="font-black text-gray-800">${item.name}</p>
                        <p class="text-[10px] font-bold text-blue-600 mb-1">ID: ${item.barcode}</p>
                        <p class="text-[10px] font-black uppercase ${item.qty < 5 ? 'text-red-500':'text-gray-400'}">STOCK: ${item.qty}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.logic.sellItem(${realIdx})" class="px-3 bg-green-100 text-green-700 rounded-xl font-black text-[10px] uppercase">Vendre</button>
                        <button onclick="app.ui.updateQty(${realIdx}, 1)" class="w-10 h-10 bg-gray-50 rounded-xl font-bold">+</button>
                    </div>
                </div>`;
        }).join('');
    }
};

app.ui.updateQty = (idx, delta) => {
    app.data.shops[app.data.activeShopIdx].inventory[idx].qty += delta;
    app.save();
};

app.render();
