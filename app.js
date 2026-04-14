const app = {
    // --- ÉTAT DE L'APPLICATION ---
    db: JSON.parse(localStorage.getItem('maboutique_master_v1')) || {
        profile: null,
        activeShopIdx: 0,
        shops: [],
        logs: [], // Entrées
        expenses: [] // Sorties
    },

    save() {
        localStorage.setItem('maboutique_master_v1', JSON.stringify(this.db));
        this.render();
    },

    // --- LOGIQUE MÉTIER ---
    logic: {
        // Vente avec prix ajustable
        sellItem(idx) {
            const shop = app.db.shops[app.db.activeShopIdx];
            const item = shop.inventory[idx];
            const inputPrice = prompt(`Vendre "${item.name}"\nID: ${item.barcode}\nPrix conseillé : ${item.sellPrice} CFA\nEntrez le prix final :`, item.sellPrice);
            
            if (inputPrice && !isNaN(inputPrice)) {
                const finalPrice = parseInt(inputPrice);
                const margin = item.buyPrice ? (finalPrice - item.buyPrice) : 0;
                
                app.db.logs.push({
                    type: 'VENTE',
                    desc: item.name,
                    val: finalPrice,
                    gain: margin,
                    time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})
                });
                
                item.qty = Math.max(0, item.qty - 1);
                app.save();
            }
        },

        // Dettes & Acomptes
        payDebt(idx) {
            const shop = app.db.shops[app.db.activeShopIdx];
            const d = shop.debts[idx];
            const amount = prompt(`Acompte de ${d.client} ? (Total dû: ${d.total - d.paid} CFA)`);
            
            if (amount && !isNaN(amount)) {
                const val = parseInt(amount);
                d.paid += val;
                app.db.logs.push({ type: 'ACOMPTE', desc: `Client: ${d.client}`, val: val, gain: 0, time: '' });
                
                if (confirm("Partager un reçu WhatsApp ?")) {
                    const msg = `*REÇU ${shop.name}*\nMerci ${d.client}.\nAcompte : ${val} CFA.\n*RESTE À PAYER : ${d.total - d.paid} CFA*`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
                }
                
                if (d.paid >= d.total) shop.debts.splice(idx, 1);
                app.save();
            }
        },

        // Ajout de données
        addNewProduct() {
            const name = prompt("Nom du produit ?");
            if (!name) return;
            const barcode = prompt("Scanner/Entrer Code ou laisser vide pour ID AUTO :") || "ID-" + Math.floor(1000 + Math.random() * 9000);
            const sell = prompt("Prix de vente standard (CFA) :");
            const buy = prompt("Prix d'achat (CFA) :");
            
            app.db.shops[app.db.activeShopIdx].inventory.push({
                name, barcode, qty: 0, 
                sellPrice: parseInt(sell) || 0, 
                buyPrice: parseInt(buy) || 0
            });
            app.save();
        },

        addNewDebt() {
            const c = prompt("Nom du client ?"), t = prompt("Total de la dette ?");
            if (c && t) { app.db.shops[app.db.activeShopIdx].debts.push({ client: c, total: parseInt(t), paid: 0 }); app.save(); }
        },

        addNewExpense() {
            const d = prompt("Motif de la dépense ?"), v = prompt("Montant ?");
            if (d && v) { app.db.expenses.push({ desc: d, val: parseInt(v), time: new Date().toLocaleTimeString() }); app.save(); }
        },

        addNewShop() {
            const n = prompt("Nom de la nouvelle boutique ?");
            if (n) {
                app.db.shops.push({ name: n, inventory: [], debts: [] });
                app.db.activeShopIdx = app.db.shops.length - 1;
                app.save();
            }
        },

        shareWhatsApp() {
            let tin = 0; let tout = 0; let tgain = 0;
            app.db.logs.forEach(l => { tin += l.val; tgain += l.gain; });
            app.db.expenses.forEach(e => tout += e.val);
            const shop = app.db.shops[app.db.activeShopIdx];
            const msg = `*BILAN ${shop.name.toUpperCase()}*\n---\n✅ ENTRÉES : ${tin} CFA\n💸 DÉPENSES : ${tout} CFA\n📈 BÉNÉFICE : ${tgain - tout} CFA\n---\n💰 *SOLDE : ${tin - tout} CFA*`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        },

        clearDay() { if (confirm("Clôturer la journée ?")) { app.db.logs = []; app.db.expenses = []; app.save(); } }
    },

    // --- SCANNER ---
    scanner: {
        instance: null,
        start(mode) {
            document.getElementById('modal-scan').classList.add('active');
            this.instance = new Html5Qrcode("reader");
            this.instance.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
                (code) => {
                    const shop = app.db.shops[app.db.activeShopIdx];
                    const idx = shop.inventory.findIndex(i => i.barcode === code);
                    app.scanner.stop();

                    if (idx !== -1) {
                        if (mode === 'vente') app.logic.sellItem(idx);
                        else {
                            const nQty = prompt(`Nouveau stock pour "${shop.inventory[idx].name}" :`, shop.inventory[idx].qty);
                            if (nQty !== null) { shop.inventory[idx].qty = parseInt(nQty); app.save(); }
                        }
                    } else { alert("Code inconnu !"); }
                }
            ).catch(err => alert("Erreur Caméra. Vérifiez HTTPS."));
        },
        stop() {
            if (this.instance) this.instance.stop();
            document.getElementById('modal-scan').classList.remove('active');
        }
    },

    // --- INTERFACE ---
    ui: {
        switchTab(tabId) {
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            document.getElementById(`view-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active', 'text-gray-500'));
            document.getElementById(`btn-${tabId}`).classList.add('tab-active');
        },
        filterStock() { app.render(); },
        toggleModal(id) { document.getElementById(id).classList.toggle('active'); },
        switchShop(idx) { app.db.activeShopIdx = idx; app.ui.toggleModal('modal-shops'); app.save(); }
    },

    // --- RENDU ---
    render() {
        if (!this.db.profile) {
            const n = prompt("Votre Nom ?"), s = prompt("Nom Boutique ?");
            if (n && s) { this.db.profile = { name: n }; this.db.shops.push({ name: s, inventory: [], debts: [] }); this.save(); }
            return;
        }

        const shop = this.db.shops[this.db.activeShopIdx];
        document.getElementById('nav-shop-name').innerText = shop.name;
        document.getElementById('nav-user-name').innerText = this.db.profile.name;

        // Stock
        const query = document.getElementById('stock-search')?.value.toLowerCase() || "";
        const filtered = shop.inventory.filter(i => i.name.toLowerCase().includes(query) || i.barcode.toLowerCase().includes(query));
        document.getElementById('inventory-list').innerHTML = filtered.map(item => {
            const realIdx = shop.inventory.indexOf(item);
            return `<div class="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                <div class="text-left text-xs"><p class="font-black text-gray-800 text-sm">${item.name}</p><p class="text-blue-600 font-bold uppercase tracking-widest">ID: ${item.barcode}</p><p class="font-black ${item.qty < 5 ? 'text-red-500':'text-gray-400'} uppercase">Stock: ${item.qty}</p></div>
                <div class="flex gap-2">
                    <button onclick="app.logic.sellItem(${realIdx})" class="px-3 bg-green-100 text-green-700 rounded-xl font-black text-[9px] uppercase">Vendre</button>
                    <button onclick="app.db.shops[${app.db.activeShopIdx}].inventory[${realIdx}].qty++; app.save();" class="w-10 h-10 bg-gray-50 rounded-xl font-bold">+</button>
                </div>
            </div>`;
        }).join('');

        // Dettes
        document.getElementById('debt-list').innerHTML = shop.debts.map((d, i) => `
            <div class="bg-white p-5 rounded-[2rem] border-l-8 border-blue-600 shadow-sm text-left">
                <div class="flex justify-between items-start mb-4">
                    <div><p class="font-black">${d.client}</p><p class="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Initial: ${d.total} CFA</p></div>
                    <div class="text-right font-black text-blue-700 text-xl">${d.total - d.paid} CFA</div>
                </div>
                <button onclick="app.logic.payDebt(${i})" class="w-full py-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">Encaisser Acompte</button>
            </div>`).join('') || '<p class="text-center py-20 text-gray-400 font-bold italic">Aucune dette.</p>';

        // Rapport
        let tin = 0, tout = 0, tgain = 0;
        const logHtml = app.db.logs.map(l => {
            tin += l.val; tgain += l.gain;
            return `<div class="flex justify-between p-3 bg-green-50 rounded-xl text-[10px] font-bold italic"><span>${l.desc}</span><span>+${l.val}</span></div>`;
        }).join('') + app.db.expenses.map(e => {
            tout += e.val;
            return `<div class="flex justify-between p-3 bg-red-50 rounded-xl text-[10px] font-bold text-red-700 italic"><span>${e.desc}</span><span>-${e.val}</span></div>`;
        }).join('');
        
        document.getElementById('rep-log').innerHTML = logHtml || '<p class="text-gray-300 py-4 text-center italic text-xs">Bilan vide</p>';
        document.getElementById('rep-in').innerText = tin + " CFA";
        document.getElementById('rep-out').innerText = tout + " CFA";
        document.getElementById('rep-gain').innerText = (tgain - tout) + " CFA";

        // Liste Boutiques Modal
        document.getElementById('shop-list-container').innerHTML = app.db.shops.map((s, idx) => `
            <div onclick="app.ui.switchShop(${idx})" class="p-4 rounded-2xl border-2 font-bold ${idx === app.db.activeShopIdx ? 'border-green-600 bg-green-50 text-green-700' : 'bg-gray-50 border-transparent'}">
                ${s.name}
            </div>`).join('');
    }
};

app.render();
