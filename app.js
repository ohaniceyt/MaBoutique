const app = {
    data: JSON.parse(localStorage.getItem('maboutique_ultra_v5')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: [], // Entrées
        expenses: [] // Sorties
    },

    save() {
        localStorage.setItem('maboutique_ultra_v5', JSON.stringify(this.data));
        this.render();
    },

    logic: {
        updateStock(idx, delta) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const item = shop.inventory[idx];
            if(delta < 0) {
                const price = prompt(`Prix de vente pour ${item.name} ? (CFA)`);
                if(price && !isNaN(price)) {
                    const profit = item.buyPrice ? (parseInt(price) - item.buyPrice) : 0;
                    app.data.logs.push({ type: 'VENTE', val: parseInt(price), gain: profit, desc: item.name, time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) });
                    item.qty = Math.max(0, item.qty - 1);
                }
            } else { item.qty += 1; }
            app.save();
        },

        addAcompte(idx) {
            const shop = app.data.shops[app.data.activeShopIdx];
            const d = shop.debts[idx];
            const val = prompt(`Acompte de ${d.client} ? (CFA)`);
            if(val) {
                const amount = parseInt(val);
                d.paid += amount;
                app.data.logs.push({ type: 'ACOMPTE', val: amount, gain: 0, desc: `Acompte: ${d.client}`, time: new Date().toLocaleTimeString() });
                if(confirm("Partager reçu WhatsApp ?")) {
                    const msg = `*Reçu Boutique ${shop.name}*\nClient: ${d.client}\nAcompte: ${amount} CFA\n*Reste: ${d.total - d.paid} CFA*`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
                }
                if(d.paid >= d.total) shop.debts.splice(idx, 1);
                app.save();
            }
        },

        shareReport() {
            let tin = 0, tout = 0, tgain = 0;
            app.data.logs.forEach(l => { tin += l.val; tgain += l.gain; });
            app.data.expenses.forEach(e => tout += e.val);
            const msg = `*BILAN ${app.data.shops[app.data.activeShopIdx].name}*\n---\n✅ Entrées: ${tin} CFA\n💸 Dépenses: ${tout} CFA\n📉 Bénéfice Net: ${tgain - tout} CFA\n---\n💰 *EN CAISSE: ${tin - tout} CFA*`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        },

        clearReport() {
            if(confirm("Vider le bilan d'aujourd'hui ?")) {
                app.data.logs = []; app.data.expenses = []; app.save();
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

        startScan() {
            document.getElementById('modal-scan').classList.add('active');
            const html5QrCode = new Html5Qrcode("reader");
            html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
                (decodedText) => {
                    const shop = app.data.shops[app.data.activeShopIdx];
                    const itemIdx = shop.inventory.findIndex(i => i.barcode === decodedText);
                    if(itemIdx !== -1) {
                        app.ui.stopScan();
                        app.logic.updateStock(itemIdx, -1);
                    } else {
                        if(confirm("Nouveau code-barres. Lier à un produit ?")) {
                            const name = prompt("Nom du produit ?");
                            shop.inventory.push({ name, qty: 0, barcode: decodedText, buyPrice: 0 });
                            app.ui.stopScan(); app.save();
                        }
                    }
                }
            );
            window.scanner = html5QrCode;
        },

        stopScan() {
            if(window.scanner) window.scanner.stop();
            document.getElementById('modal-scan').classList.remove('active');
        },

        addProduct() {
            const n = prompt("Nom du produit ?");
            const p = prompt("Prix d'achat unitaire (facultatif, pour calcul bénéfice) :");
            if(n) { app.data.shops[app.data.activeShopIdx].inventory.push({ name: n, qty: 0, buyPrice: parseInt(p)||0 }); app.save(); }
        },

        addExpense() {
            const d = prompt("Motif de la dépense ?");
            const v = prompt("Montant (CFA) ?");
            if(d && v) { app.data.expenses.push({ desc: d, val: parseInt(v), time: new Date().toLocaleTimeString() }); app.save(); }
        },

        addDebt() {
            const c = prompt("Nom du client ?"), t = prompt("Montant Dette ?");
            if(c && t) { app.data.shops[app.data.activeShopIdx].debts.push({ client: c, total: parseInt(t), paid: 0 }); app.save(); }
        }
    },

    render() {
        if(!this.data.profile) {
            const name = prompt("Votre Nom ?"); const shop = prompt("Nom Boutique ?");
            if(name && shop) { this.data.profile = { name }; this.data.shops.push({ name: shop, inventory: [], debts: [], team: [name] }); this.save(); }
            return;
        }

        const shop = this.data.shops[this.data.activeShopIdx];
        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.data.profile.name;

        // Render Stock
        document.getElementById('view-stock').innerHTML = shop.inventory.map((item, i) => `
            <div class="bg-white p-5 rounded-3xl shadow-sm flex justify-between items-center border border-white">
                <div><p class="font-black">${item.name}</p><p class="text-[10px] font-bold text-gray-400 tracking-widest">${item.qty} EN STOCK</p></div>
                <div class="flex gap-2"><button onclick="app.logic.updateStock(${i},-1)" class="w-12 h-12 bg-gray-50 rounded-2xl font-black">-</button>
                <button onclick="app.logic.updateStock(${i},1)" class="w-12 h-12 bg-green-50 text-green-600 rounded-2xl font-black">+</button></div>
            </div>`).join('');

        // Render Dettes
        document.getElementById('view-dettes').innerHTML = shop.debts.map((d, i) => `
            <div class="bg-white p-6 rounded-[2rem] border-l-8 border-blue-600 shadow-sm">
                <div class="flex justify-between mb-4"><div><p class="font-black">${d.client}</p><p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Initial: ${d.total} CFA</p></div>
                <div class="text-right"><p class="text-2xl font-black text-blue-700">${d.total-d.paid}</p><p class="text-[8px] font-bold text-gray-400">RESTE</p></div></div>
                <button onclick="app.logic.addAcompte(${i})" class="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100">Encaisser Acompte</button>
            </div>`).join('');

        // Render Rapport
        let tin = 0, tout = 0, tgain = 0;
        const logHtml = app.data.logs.map(l => {
            tin += l.val; tgain += l.gain;
            return `<div class="flex justify-between items-center p-3 bg-green-50/50 rounded-2xl text-xs"><div class="text-left"><p class="font-bold text-green-700">${l.type} - ${l.desc}</p></div><p class="font-black">+${l.val}</p></div>`;
        }).join('') + app.data.expenses.map(e => {
            tout += e.val;
            return `<div class="flex justify-between items-center p-3 bg-red-50/50 rounded-2xl text-xs"><div class="text-left"><p class="font-bold text-red-700">SORTIE - ${e.desc}</p></div><p class="font-black">-${e.val}</p></div>`;
        }).join('');

        document.getElementById('rep-in').innerText = tin + " CFA";
        document.getElementById('rep-out').innerText = tout + " CFA";
        document.getElementById('rep-gain').innerText = (tgain - tout) + " CFA";
        document.getElementById('rep-log').innerHTML = logHtml;
    }
};

app.render();
