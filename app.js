/**
 * トイレジストリ - おもちゃ管理アプリ
 */

class ToyRegistry {
    constructor() {
        this.data = {
            children: ["りつ", "れい", "そう"],
            toys: []
        };
        this.html5QrCode = null;
        this.scannerActive = false;

        // アフィリエイト設定（ハードコーディング）
        this.AFFILIATE = {
            amazon: { a_id: "614065", p_id: "170" },
            rakuten: { a_id: "614062", p_id: "54" },
            yahoo: { a_id: "1003440", p_id: "1225" }
        };

        // Yahoo!ショッピングAPIのクライアントID
        this.YAHOO_APP_ID = "dmVyPTIwMjUwNyZpZD1uRUV1YzVWUlJtJmhhc2g9TW1ZMFpqUmpabVF5TUdJNE5UazVaUQ";

        // DOM要素
        this.elements = {
            reader: document.getElementById('reader'),
            janInput: document.getElementById('jan-input'),
            manualSearchBtn: document.getElementById('manual-search-btn'),
            resultPanel: document.getElementById('result-panel'),
            productImage: document.getElementById('product-image'),
            productName: document.getElementById('product-name'),
            productJan: document.getElementById('product-jan'),
            ownerTableContainer: document.getElementById('owner-table-container'),
            toyList: document.getElementById('toy-list'),
            closeResult: document.getElementById('close-result'),
            addToyBtn: document.getElementById('add-toy-btn'),
            toySearch: document.getElementById('toy-search'),
            manageChildrenBtn: document.getElementById('manage-children-btn'),
            childrenModal: document.getElementById('children-modal'),
            closeModal: document.getElementById('close-modal'),
            childrenListContainer: document.getElementById('children-list-container'),
            newChildName: document.getElementById('new-child-name'),
            addChildBtn: document.getElementById('add-child-btn'),
            exportDataBtn: document.getElementById('export-data-btn'),
            importDataBtn: document.getElementById('import-data-btn'),
            importFile: document.getElementById('import-file'),
            notificationContainer: document.getElementById('notification-container'),
            productLinkContainer: document.getElementById('product-link-container')
        };

        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderToyList();
        this.initScanner();
    }

    // --- データ管理 ---

    loadData() {
        const saved = localStorage.getItem('toy_registry_data');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
                // 互換性チェック
                if (!this.data.children) this.data.children = ["りつ", "れい", "そう"];
                if (!this.data.toys) this.data.toys = [];
            } catch (e) {
                console.error("データの読み込みに失敗しました", e);
            }
        }
    }

    saveData() {
        localStorage.setItem('toy_registry_data', JSON.stringify(this.data));
    }

    // --- イベント設定 ---

    setupEventListeners() {
        // 検索ボタン
        this.elements.manualSearchBtn.addEventListener('click', () => {
            const jan = this.elements.janInput.value.trim();
            if (jan) this.processJAN(jan);
        });

        // 検索結果パネルを閉じる
        this.elements.closeResult.addEventListener('click', () => {
            this.elements.resultPanel.classList.add('hidden');
        });

        // リストに追加ボタン
        this.elements.addToyBtn.addEventListener('click', () => {
            this.saveCurrentResult();
        });

        // おもちゃ検索
        this.elements.toySearch.addEventListener('input', (e) => {
            this.renderToyList(e.target.value);
        });

        // 子供管理モーダル
        this.elements.manageChildrenBtn.addEventListener('click', () => {
            this.openChildrenModal();
        });

        this.elements.closeModal.addEventListener('click', () => {
            this.elements.childrenModal.classList.add('hidden');
        });

        this.elements.addChildBtn.addEventListener('click', () => {
            this.addChild();
        });

        // データ保存・読込
        this.elements.exportDataBtn.addEventListener('click', () => this.exportData());
        this.elements.importDataBtn.addEventListener('click', () => this.elements.importFile.click());
        this.elements.importFile.addEventListener('change', (e) => this.importData(e));
    }

    // --- スキャン機能 ---

    initScanner() {
        this.html5QrCode = new Html5Qrcode("reader");

        // スキャン枠の設定（16:9の画面内でも中央に来るように計算）
        const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(viewfinderWidth * 0.8);
            const height = Math.floor(width * 0.5); // 横長バーコードに最適化
            return { width, height };
        };

        const config = {
            fps: 10,
            qrbox: qrboxFunction,
            aspectRatio: 1.77 // 横長にして縦の占有を減らす（16:9に近い比率）
        };

        this.html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // スキャン成功
                console.log(`Scan result: ${decodedText}`);
                this.processJAN(decodedText);
            },
            (errorMessage) => {
                // スキャン中（エラーは無視）
            }
        ).catch((err) => {
            console.error("Scanner error:", err);
            this.showNotification("カメラの起動に失敗しました。");
        });
    }

    // --- 商品処理 ---

    async processJAN(jan) {
        // 重複チェック
        const existingToy = this.data.toys.find(t => t.jan === jan);

        this.elements.resultPanel.classList.remove('hidden');
        this.elements.productName.innerHTML = `
            <div class="loading-spinner-container">
                <div class="spinner"></div>
                <span>商品を探しています...</span>
            </div>
        `;
        this.elements.productJan.innerText = jan;
        this.elements.productImage.src = "";
        this.elements.addToyBtn.disabled = true; // 検索中はボタン無効化

        // APIから情報取得
        const info = await this.fetchProductInfo(jan);

        this.elements.addToyBtn.disabled = false;
        this.renderProductNameEditor(info.name);
        this.elements.productImage.src = info.image;

        // マルチモール・詳細リンクの表示
        this.renderProductLinks(jan, info.url);

        // 所有者テーブルの描画
        const initialOwners = existingToy ? { ...existingToy.owners } : {};
        const currentOwners = {};
        this.data.children.forEach(name => {
            currentOwners[name] = initialOwners[name] || false;
        });

        this.renderOwnerTable(currentOwners, jan);

        if (existingToy) {
            this.showNotification("既にリストにあるおもちゃです！");
        }
    }

    renderProductLinks(jan, yahooDirectUrl) {
        const container = this.elements.productLinkContainer;
        container.innerHTML = '';

        const malls = [
            {
                name: 'Yahoo!ショッピング',
                id: 'yahoo',
                color: '#ff0033',
                icon: 'https://shopping.yahoo.co.jp/favicon.ico',
                baseUrl: yahooDirectUrl || `https://shopping.yahoo.co.jp/search?p=${jan}`,
                m_id: '1'
            },
            {
                name: 'Amazon',
                id: 'amazon',
                color: '#ff9900',
                icon: 'https://www.amazon.co.jp/favicon.ico',
                baseUrl: `https://www.amazon.co.jp/s?k=${jan}`,
                m_id: '1'
            },
            {
                name: '楽天市場',
                id: 'rakuten',
                color: '#bf0000',
                icon: 'https://www.rakuten.co.jp/favicon.ico',
                baseUrl: `https://search.rakuten.co.jp/search/mall/${jan}/`,
                m_id: '1'
            }
        ];

        const wrapper = document.createElement('div');
        wrapper.className = 'mall-links-wrapper';

        malls.forEach(mall => {
            const config = this.AFFILIATE[mall.id];
            // もしもアフィリエイトのリンク生成
            // 形式: https://af.moshimo.com/af/c/click?a_id=[A_ID]&p_id=[P_ID]&pc_id=[PC_ID]&m_id=[M_ID]&url=[ENCODED_URL]
            // 今回いただいた情報を元に pc_id は p_id と同じもの、または固定値として扱う
            // Amazon: p_id=170, pc_id=185
            // 楽天: p_id=54, pc_id=54
            // Yahoo: p_id=1225, pc_id=1925

            let pc_id = config.p_id;
            if (mall.id === 'amazon') pc_id = '185';
            if (mall.id === 'yahoo') pc_id = '1925';

            const finalUrl = `https://af.moshimo.com/af/c/click?a_id=${config.a_id}&p_id=${config.p_id}&pc_id=${pc_id}&m_id=${mall.m_id}&url=${encodeURIComponent(mall.baseUrl)}`;

            const link = document.createElement('a');
            link.href = finalUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = `mall-btn ${mall.id}`;
            link.innerHTML = `
                <img src="${mall.icon}" alt="${mall.name}" onerror="this.src='https://placehold.jp/16/ffffff/333333/16x16.png?text=${mall.name[0]}'">
                <span>${mall.name}</span>
            `;
            wrapper.appendChild(link);
        });

        container.appendChild(wrapper);
    }

    renderProductNameEditor(name) {
        // 商品名をタップして編集できるUI
        // iPhoneでのタップ誤爆を防ぐため、しっかりとした入力欄として描画
        this.elements.productName.innerHTML = `
            <div class="edit-wrapper">
                <label for="product-name-edit">商品名（タップして編集）</label>
                <input type="text" id="product-name-edit" class="edit-input" value="${name}" 
                       placeholder="商品名を入力してください" enterkeyhint="done">
            </div>
        `;
        this.elements.productNameEdit = document.getElementById('product-name-edit');

        // 自動でフォーカスを当てない（キーボードが勝手に出ると邪魔なため）
        // タップした時は確実に反応するようにイベントを補強
        this.elements.productNameEdit.addEventListener('touchstart', (e) => {
            e.stopPropagation(); // 親要素のイベント干渉を防ぐ
        });
    }

    async fetchProductInfo(jan) {
        // Yahoo!ショッピングAPI v3 (商品検索) を使用して情報を取得
        // より高速な corsproxy.io を使用
        const yahooUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${this.YAHOO_APP_ID}&jan_code=${jan}&results=1`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`;

        try {
            // ローカルデモ用の特定JANコードはそのまま優先
            const mockData = {
                "4904810123456": { name: "トミカ No.1 日産 GT-R", image: "https://www.takaratomy.co.jp/products/tomica/lineup/regular/img/001.jpg" },
                "4904810123457": { name: "トミカ No.2 SUBARU WRX S4 STI Sport R EX", image: "https://www.takaratomy.co.jp/products/tomica/lineup/regular/img/002.jpg" }
            };
            if (mockData[jan]) return mockData[jan];

            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("APIエラー");

            const data = await response.json();

            if (data.hits && data.hits.length > 0) {
                const item = data.hits[0];
                return {
                    name: item.name,
                    image: item.image.medium || item.image.small || `https://placehold.jp/24/333333/ffffff/200x200.png?text=Toy+${jan}`,
                    url: item.url
                };
            }
        } catch (error) {
            console.warn("API連携に失敗しました（CORS制限またはNWエラー）。", error);
        }

        // 取得失敗時はURLなしで返す
        return {
            name: `商品情報 (JAN: ${jan})`,
            image: `https://placehold.jp/24/333333/ffffff/200x200.png?text=Toy+${jan}`,
            url: null
        };
    }

    renderOwnerTable(owners, jan) {
        this.elements.ownerTableContainer.innerHTML = '';

        this.data.children.forEach(name => {
            const row = document.createElement('div');
            row.className = 'owner-row';

            const nameEl = document.createElement('span');
            nameEl.className = 'owner-name';
            nameEl.innerText = name;

            const check = document.createElement('div');
            check.className = `owner-check ${owners[name] ? 'has' : ''}`;
            check.innerText = owners[name] ? '◯' : '✕';

            check.addEventListener('click', () => {
                owners[name] = !owners[name];
                check.className = `owner-check ${owners[name] ? 'has' : ''}`;
                check.innerText = owners[name] ? '◯' : '✕';
                this.currentTempOwners = owners; // 一時保存
            });

            row.appendChild(nameEl);
            row.appendChild(check);
            this.elements.ownerTableContainer.appendChild(row);
        });

        this.currentTempOwners = owners;
        this.currentTempJan = jan;
    }

    saveCurrentResult() {
        const jan = this.currentTempJan;
        const name = this.elements.productNameEdit ? this.elements.productNameEdit.value : this.elements.productName.innerText;
        const image = this.elements.productImage.src;
        const owners = this.currentTempOwners;

        const existingIndex = this.data.toys.findIndex(t => t.jan === jan);

        const toyData = {
            jan,
            name,
            image,
            owners,
            updateAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            this.data.toys[existingIndex] = toyData;
        } else {
            this.data.toys.unshift(toyData);
        }

        this.saveData();
        this.renderToyList();
        this.elements.resultPanel.classList.add('hidden');
        this.showNotification("保存しました！");
    }

    // --- 一覧描画 ---

    renderToyList(filter = "") {
        this.elements.toyList.innerHTML = '';
        const search = filter.toLowerCase();

        const filtered = this.data.toys.filter(t =>
            t.name.toLowerCase().includes(search) || t.jan.includes(search)
        );

        filtered.forEach(toy => {
            const card = document.createElement('div');
            card.className = 'toy-card';
            card.innerHTML = `
                <div class="toy-thumb">
                    <img src="${toy.image}" alt="${toy.name}" onerror="this.src='https://placehold.jp/24/333333/ffffff/200x200.png?text=No+Image'">
                </div>
                <div class="toy-info">
                    <div class="toy-name" title="${toy.name}">${toy.name}</div>
                    <div class="toy-owners">
                        ${this.data.children.map(name => `
                            <span class="mini-badge ${toy.owners[name] ? 'active' : ''}" 
                                  style="background: ${this.getChildColor(name)}" 
                                  title="${name}">${name[0]}</span>
                        `).join('')}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.processJAN(toy.jan);
            });

            this.elements.toyList.appendChild(card);
        });
    }

    getChildColor(name) {
        const colors = ['#38bdf8', '#4ade80', '#fb923c', '#f472b6', '#c084fc'];
        const index = this.data.children.indexOf(name);
        return colors[index % colors.length];
    }

    // --- 子供管理 ---

    openChildrenModal() {
        this.elements.childrenModal.classList.remove('hidden');
        this.renderChildrenList();
    }

    renderChildrenList() {
        this.elements.childrenListContainer.innerHTML = '';
        this.data.children.forEach((name, index) => {
            const row = document.createElement('div');
            row.className = 'owner-row';
            row.innerHTML = `
                <span class="owner-name">${name}</span>
                <button class="btn-icon danger" onclick="app.deleteChild(${index})">🗑️</button>
            `;
            this.elements.childrenListContainer.appendChild(row);
        });
    }

    addChild() {
        const name = this.elements.newChildName.value.trim();
        if (name && !this.data.children.includes(name)) {
            this.data.children.push(name);
            this.elements.newChildName.value = '';
            this.saveData();
            this.renderChildrenList();
            this.renderToyList();
            this.showNotification(`${name}君を追加しました`);
        }
    }

    deleteChild(index) {
        const name = this.data.children[index];
        if (confirm(`${name}君をリストから削除しますか？持っているおもちゃのチェックからも消えます。`)) {
            this.data.children.splice(index, 1);
            this.saveData();
            this.renderChildrenList();
            this.renderToyList();
        }
    }

    // --- インポート/エクスポート ---

    exportData() {
        const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toy_registry_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.children && imported.toys) {
                    if (confirm("データを上書きしますか？現在のデータは消去されます。")) {
                        this.data = imported;
                        this.saveData();
                        this.renderToyList();
                        this.showNotification("データを読み込みました");
                    }
                } else {
                    throw new Error("Invalid format");
                }
            } catch (err) {
                alert("ファイルの形式が正しくありません。");
            }
        };
        reader.readAsText(file);
    }

    // --- 通知 ---

    showNotification(message) {
        const el = document.createElement('div');
        el.className = 'notification';
        el.innerText = message;
        this.elements.notificationContainer.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2000);
    }
}

// グローバルインスタンス
const app = new ToyRegistry();
