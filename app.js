const app = {
    data: JSON.parse(localStorage.getItem('maboutique_ultra_v8')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: [],
        expenses: []
    },

    save() {
        localStorage.setItem('maboutique_ultra_v8', JSON.stringify(this.data));
        this.render();
    },

    logic: {
        sellItem(idx) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const item = shop.inventory[idx];
            const price = prompt(`Prix de vente pour "${item.name}" :`, item.price || 0);
            
            if (price !== null && !isNaN(price) && price !== "") {
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
            let totalIn = 0; let totalOut = 0;
            app.data.logs.forEach(l => totalIn += l.val);
            app.data.expenses.forEach(e => totalOut += e.val);
            const shop = app.data.shops[app.data.activeShopIdx];
            const msg = `*BILAN ${shop.name}*\n---\n💰 Entrées: ${totalIn} CFA\n💸 Dépenses: ${totalOut} CFA\n🔥 *TOTAL: ${totalIn - totalOut} CFA*`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        },

        clearReport() {
            if(confirm("Effacer les transactions du jour ?")) {
                app.data.logs = [];
                app.data.expenses = [];
                app.save();
            }
        }
    },

    ui: {
        filterStock() { app.render(); },

        switchTab(tabId) {
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`view-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active', 'text-gray-500'));
            document.getElementById(`btn-${tabId}`).classList.add('tab-active');
        },

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
                            const nQty = prompt(`Nouveau stock pour "${shop.inventory[idx].name}" :`, shop.inventory[idx].qty);
                            if (nQty !== null) { shop.inventory[idx].qty = parseInt(nQty); app.save(); }
                        }
                    } else { alert("Produit inconnu !"); }
                }
            ).catch(err => console.error(err));
            window.activeScanner = scanner;
        },

        stopScan(scannerInstance) {
            const s = scannerInstance || window.activeScanner;
            if (s) s.stop();
            document.getElementById('modal-scan').classList.remove('active');
        },

        openShopMenu() {
            const container = document.getElementById('shop-list-container');
            container.innerHTML = app.data.shops.map((s, idx) => `
                <div onclick="app.ui.switchShop(${idx})" class="p-4 rounded-2xl border-2 font-bold ${idx === app.data.activeShopIdx ? 'border-green-600 bg-green-50 text-green-700' : 'bg-gray-50'}">
                    ${s.name}
                </div>`).join('');
            document.getElementById('modal-shops').classList.add('active');
        },

        switchShop(idx) { app.data.activeShopIdx = idx; app.ui.closeModals(); app.save(); },
        closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); },

        addProduct() {
            const name = prompt("Nom du produit ?");
            if (!name) return;
            const barcode = prompt("ID/Code-barres (laisser vide pour AUTO) :") || "STK-" + Math.floor(1000 + Math.random() * 9000);
            const price = prompt("Prix de vente standard (CFA) :");
            const buy = prompt("Prix d'achat (CFA) :");
            app.data.shops[app.data.activeShopIdx].inventory.push({ name, qty: 0, barcode, price: parseInt(price)||0, buyPrice: parseInt(buy)||0 });
            app.save();
        },

        addDebt() {
            const c = prompt("Nom du client ?"), t = prompt("Total dû ?");
            if (c && t) { app.data.shops[app.data.activeShopIdx].debts.push({ client: c, total: parseInt(t), paid: 0 }); app.save(); }
        },

        addExpense() {
            const d = prompt("Motif ?"), v = prompt("Montant ?");
            if (d && v) { app.data.expenses.push({ desc: d, val: parseInt(v), time: new Date().toLocaleTimeString() }); app.save(); }
        }
    },

    render() {
        if (!this.data.profile) {
            const n = prompt("Votre Nom ?"), s = prompt("Boutique ?");
            if (n && s) { this.data.profile = { name: n }; this.data.shops.push({ name: s, inventory: [], debts: [] }); this.save(); }
            return;
        }

        const shop = this.data.shops[this.data.activeShopIdx];
        if(!shop) return;

        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.data.profile.name;

        // Render Stock
        const query = document.getElementById('stock-search')?.value.toLowerCase() || "";
        const filtered = shop.inventory.filter(i => i.name.toLowerCase().includes(query) || i.barcode.toLowerCase().includes(query));
        
        document.getElementById('inventory-list').innerHTML = filtered.map(item => {
            const realIdx = shop.inventory.indexOf(item);
            return `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div class="text-left">
                        <p class="font-black text-gray-800 text-sm">${item.name}</p>
                        <p class="text-[10px] font-bold text-blue-600 mb-1 tracking-tighter uppercase">ID: ${item.barcode}</p>
                        <p class="text-[10px] font-black ${item.qty < 5 ? 'text-red-500 animate-pulse' : 'text-gray-400'} uppercase tracking-widest">Stock: ${item.qty}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.logic.sellItem(${realIdx})" class="px-3 py-2 bg-green-100 text-green-700 rounded-xl font-black text-[9px] uppercase">Vendre</button>
                        <button onclick="app.ui.updateQuick(${realIdx}, 1)" class="w-10 h-10 bg-gray-50 rounded-xl font-bold">+</button>
                    </div>
                </div>`;
        }).join('');

        // Render Dettes
        document.getElementById('debt-list').innerHTML = shop.debts.map((d, i) => `
            <div class="bg-white p-5 rounded-[2rem] border-l-8 border-blue-600 shadow-sm text-left">
                <div class="flex justify-between items-start mb-4">
                    <div><p class="font-black">${d.client}</p><p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Total: ${d.total} CFA</p></div>
                    <div class="text-right font-black text-blue-700 text-xl">${d.total - d.paid} CFA</div>
                </div>
                <button onclick="app.ui.payDebt(${i})" class="w-full py-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase border border-blue-100">Encaisser Acompte</button>
            </div>`).join('') || '<p class="py-10 text-gray-400 text-center font-bold">Aucune dette.</p>';

        // Render Rapport
        let tIn = 0; let tOut = 0;
        const logHtml = app.data.logs.map(l => {
            tIn += l.val;
            return `<div class="flex justify-between p-3 bg-green-50 rounded-xl text-[10px] font-bold italic"><span>${l.desc}</span><span>+${l.val}</span></div>`;
        }).join('') + app.data.expenses.map(e => {
            tOut += e.val;
            return `<div class="flex justify-between p-3 bg-red-50 rounded-xl text-[10px] font-bold text-red-700 italic"><span>${e.desc}</span><span>-${e.val}</span></div>`;
        }).join('');
        
        document.getElementById('rep-log').innerHTML = logHtml || '<p class="py-4 text-gray-300 text-center text-xs italic">Bilan vide</p>';
        document.getElementById('total-cash').innerText = (tIn - tOut) + " CFA";
    }
};

app.ui.updateQuick = (idx, delta) => {
    app.data.shops[app.data.activeShopIdx].inventory[idx].qty += delta;
    app.save();
};

app.ui.payDebt = (idx) => {
    const shop = app.data.shops[app.data.activeShopIdx];
    const d = shop.debts[idx];
    const val = prompt(`Acompte de ${d.client} ?`);
    if(val) {
        d.paid += parseInt(val);
        app.data.logs.push({ type: 'ACOMPTE', val: parseInt(val), desc: `Acompte: ${d.client}`, time: '' });
        if(d.paid >= d.total) shop.debts.splice(idx, 1);
        app.save();
    }
};

app.render();
