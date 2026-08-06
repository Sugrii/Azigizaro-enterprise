
  const firebaseConfig = {
    databaseURL: "https://azigizaro-enterprise-default-rtdb.firebaseio.com/"
  };

  // Replace with your Paystack Public Key from paystack.com
   //const PAYSTACK_PUBLIC_KEY = "pk_test_83ef5571585074d04c4e27091aa867e1db960ed6"; 

  let dbRef = null;
  let isRemoteSync = false;
  let syncKey = '';
  let connectedStores = [];
  let selectedPlanAmount = 100;
  let selectedPlanType = 'monthly';

  if (window.firebase && !firebase.apps.length) {
    try {
      firebase.initializeApp(firebaseConfig);
    } catch(e) { console.error("Firebase Initialization Error", e); }
  }

  // Users Directory
  const defaultUsers = [
    { username: "admin", password: "123", security: "blue", shopName: "Asetena Main Shop", isDemo: false }
  ];

  let users = JSON.parse(localStorage.getItem('mb_users')) || defaultUsers;
  let currentUser = localStorage.getItem('mb_logged_user') || null;

  // Active Store Data Containers
  let inventory = [];
  let customers = [];
  let salesLog = [];
  let securityPin = '1234';
  let currencySymbol = 'GH₵';
  let shopAddress = 'Accra, Ghana';
  let shopPhone = '+233 (0) 24 000 0000';
  let receiptSerialCounter = 100001;
  let cart = [];
  let isResetUnlocked = false;
  let unlockedCards = {};

  // Sample inventory preset ONLY for demo accounts
  const demoPresetInventory = [
    { id: 1, name: "African Print Fabric (1m)", price: 45.00, stock: 15 },
    { id: 2, name: "Silk Thread Roll", price: 15.00, stock: 5 },
    { id: 3, name: "Tailoring Scissors 10-inch", price: 85.00, stock: 8 }
  ];

  function getUserStorageKey(keyName) {
    const userClean = currentUser ? currentUser.toLowerCase().trim() : 'guest';
    return `mb_store_${userClean}_${keyName}`;
  }

  function fmtCurr(val) {
    const num = parseFloat(val) || 0;
    return `${currencySymbol} ${num.toFixed(2)}`;
  }

  function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('newsletterEmail').value;
    if (email) {
      const msg = document.getElementById('newsletterMsg');
      msg.innerText = `🎉 Thank you! ${email} has been subscribed to our business updates.`;
      msg.style.display = 'block';
      document.getElementById('newsletterEmail').value = '';
    }
  }

  function toggleFaq(el) {
    const answer = el.nextElementSibling;
    const indicator = el.querySelector('span');
    if (answer.style.display === "block") {
      answer.style.display = "none";
      indicator.innerText = "+";
    } else {
      answer.style.display = "block";
      indicator.innerText = "-";
    }
  }

  function handleFeedbackSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('fbName').value.trim();
    const msg = document.getElementById('fbMessage').value.trim();
    if (name && msg) {
      const status = document.getElementById('fbStatus');
      status.innerText = "Thank you! Your feedback has been submitted successfully.";
      status.style.display = "block";
      document.getElementById('fbName').value = '';
      document.getElementById('fbEmail').value = '';
      document.getElementById('fbMessage').value = '';
    } else {
      alert("Please fill in your name and feedback message.");
    }
  }

  function loadUserData() {
    if (!currentUser) return;

    const isDemo = isCurrentDemoAccount();

    const savedInventory = localStorage.getItem(getUserStorageKey('inventory'));
    const savedCustomers = localStorage.getItem(getUserStorageKey('customers'));
    const savedSales = localStorage.getItem(getUserStorageKey('sales'));
    const savedPin = localStorage.getItem(getUserStorageKey('security_pin'));
    const savedSyncKey = localStorage.getItem(getUserStorageKey('sync_key'));
    const savedConnected = localStorage.getItem(getUserStorageKey('connected_stores'));
    const savedCurrency = localStorage.getItem(getUserStorageKey('currency'));
    const savedAddress = localStorage.getItem(getUserStorageKey('shop_address'));
    const savedPhone = localStorage.getItem(getUserStorageKey('shop_phone'));
    const savedSerial = localStorage.getItem(getUserStorageKey('receipt_serial'));

    inventory = savedInventory !== null ? JSON.parse(savedInventory) : (isDemo ? [...demoPresetInventory] : []);
    customers = savedCustomers !== null ? JSON.parse(savedCustomers) : (isDemo ? [{ id: 101, name: "Kofi Mensah", phone: "024-000-0000" }] : []);
    salesLog = savedSales !== null ? JSON.parse(savedSales) : [];

    securityPin = savedPin || '1234';
    syncKey = savedSyncKey || '';
    connectedStores = savedConnected ? JSON.parse(savedConnected) : [];
    currencySymbol = savedCurrency || 'GH₵';
    shopAddress = savedAddress || 'Accra, Ghana';
    shopPhone = savedPhone || '+233 (0) 24 000 0000';
    receiptSerialCounter = savedSerial ? parseInt(savedSerial) : 100001;

    cart = [];
    unlockedCards = {};
  }

  function isCurrentDemoAccount() {
    if (!currentUser) return false;
    const userObj = users.find(u => u.username.toLowerCase() === currentUser.toLowerCase());
    return userObj ? !!userObj.isDemo : false;
  }

  function demoGuard(actionCallback) {
    if (isCurrentDemoAccount()) {
      alert("🔒 DEMO ACCOUNT FEATURE LOCKED!\n\nThis feature is disabled in the free demo account.\n\nPlease subscribe to a paid plan to unlock full store capabilities.");
      openAuthModal('subscribe');
      return false;
    }
    if (typeof actionCallback === 'function') actionCallback();
    return true;
  }

  function triggerImportJSON() {
    document.getElementById('importJsonInput').click();
  }

  function updateTimeGreeting() {
    const hour = new Date().getHours();
    let greeting = "";

    if (hour >= 5 && hour < 12) greeting = "Good Morning 🌅";
    else if (hour >= 12 && hour < 17) greeting = "Good Afternoon ☀️";
    else if (hour >= 17 && hour < 22) greeting = "Good Evening 🌙";
    else greeting = "Good Night 🌌";

    const greetingEl = document.getElementById('landingTimeGreeting');
    if (greetingEl) greetingEl.innerText = greeting;
  }

  function saveData() {
    localStorage.setItem('mb_users', JSON.stringify(users));

    if (currentUser) {
      localStorage.setItem('mb_logged_user', currentUser);
      localStorage.setItem(getUserStorageKey('inventory'), JSON.stringify(inventory));
      localStorage.setItem(getUserStorageKey('customers'), JSON.stringify(customers));
      localStorage.setItem(getUserStorageKey('sales'), JSON.stringify(salesLog));
      localStorage.setItem(getUserStorageKey('security_pin'), securityPin);
      localStorage.setItem(getUserStorageKey('sync_key'), syncKey);
      localStorage.setItem(getUserStorageKey('connected_stores'), JSON.stringify(connectedStores));
      localStorage.setItem(getUserStorageKey('currency'), currencySymbol);
      localStorage.setItem(getUserStorageKey('shop_address'), shopAddress);
      localStorage.setItem(getUserStorageKey('shop_phone'), shopPhone);
      localStorage.setItem(getUserStorageKey('receipt_serial'), receiptSerialCounter.toString());
    } else {
      localStorage.removeItem('mb_logged_user');
    }

    if (dbRef && !isRemoteSync && syncKey) {
      dbRef.set({
        inventory,
        customers,
        salesLog,
        currencySymbol,
        updatedAt: Date.now()
      }).catch(err => console.error("Firebase Sync Error:", err));
    }
  }

  function updateCurrencySetting() {
    currencySymbol = document.getElementById('currencySelector').value;
    saveData();
    renderInventory();
    renderCart();
    renderStats();
  }

  function updateShopInfoSetting() {
    shopAddress = document.getElementById('settingShopAddress').value.trim() || 'Accra, Ghana';
    shopPhone = document.getElementById('settingShopPhone').value.trim() || '+233 (0) 24 000 0000';
    saveData();
  }

  function openAuthModal(view) {
    document.getElementById('authModal').style.display = 'flex';
    switchAuthView(view);
  }

  function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  function switchAuthView(view) {
    const modalViews = ['demoForm', 'loginForm', 'subscribeForm', 'registerForm', 'forgotForm', 'faqModalView', 'feedbackModalView', 'aboutModalView', 'termsModalView', 'privacyModalView'];
    modalViews.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });

    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authSubtitle');

    if (view === 'demo') {
      document.getElementById('demoForm').style.display = 'flex';
      title.innerText = "🎮 Create Free Demo Shop";
      subtitle.innerText = "Test out POS register, cart & receipt features instantly.";
    } else if (view === 'login') {
      document.getElementById('loginForm').style.display = 'flex';
      title.innerText = "🔐 Sign In";
      subtitle.innerText = "Welcome back! Enter credentials to access your store.";
    } else if (view === 'subscribe') {
      document.getElementById('subscribeForm').style.display = 'flex';
      title.innerText = "🚀 Subscribe to Azigizaro Enterprise Shop Manager";
      subtitle.innerText = "Select a plan & complete Mobile Money payment to register.";
    } else if (view === 'register') {
      document.getElementById('registerForm').style.display = 'flex';
      title.innerText = "📝 Complete Registration";
      subtitle.innerText = "Set up your store name & login credentials.";
    } else if (view === 'forgot') {
      document.getElementById('forgotForm').style.display = 'flex';
      title.innerText = "🔑 Recover Account";
      subtitle.innerText = "Reset your password with your security answer.";
    } else if (view === 'faq') {
      document.getElementById('faqModalView').style.display = 'flex';
      title.innerText = "❓ Frequently Asked Questions";
      subtitle.innerText = "Find quick answers to common questions about Azigizaro POS.";
    } else if (view === 'feedback') {
      document.getElementById('feedbackModalView').style.display = 'flex';
      title.innerText = "💬 Customer Feedback";
      subtitle.innerText = "We value your input! Send us your thoughts or review.";
    } else if (view === 'about') {
      document.getElementById('aboutModalView').style.display = 'flex';
      title.innerText = "ℹ️ About Our Platform";
      subtitle.innerText = "Empowering commerce and POS tracking in Ghana.";
    } else if (view === 'terms') {
      document.getElementById('termsModalView').style.display = 'flex';
      title.innerText = "📜 Terms of Service";
      subtitle.innerText = "Guidelines governing your shop account and software use.";
    } else if (view === 'privacy') {
      document.getElementById('privacyModalView').style.display = 'flex';
      title.innerText = "🔒 Privacy Policy";
      subtitle.innerText = "How we protect and secure your business information.";
    }
  }

  function selectPlan(amount, planType, element) {
    selectedPlanAmount = amount;
    selectedPlanType = planType;
    document.querySelectorAll('.plan-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('payAmountDisplay').innerText = amount.toFixed(2);
  }

  function processMoMoPayment() {
    const fullName = document.getElementById('subFullName').value.trim();
    const email = document.getElementById('subEmail').value.trim();
    const phone = document.getElementById('subPhone').value.trim();

    if (!fullName || !email || !phone) {
      return alert("Please fill out your Full Name, Email, and Phone Number.");
    }

    if (typeof PaystackPop === 'undefined') {
      if (confirm(`[OFFLINE DEMO MODE]\nSimulate successful Mobile Money payment of GH₵ ${selectedPlanAmount} for ${fullName}?`)) {
        document.getElementById('paymentVerifiedBadge').style.display = 'block';
        switchAuthView('register');
      }
      return;
    }

    const handler = PaystackPop.setup({
      key: typeof PAYSTACK_PUBLIC_KEY !== 'undefined' ? PAYSTACK_PUBLIC_KEY : '',
      email: email,
      amount: selectedPlanAmount * 100,
      currency: "GHS",
      ref: 'AB_' + Math.floor((Math.random() * 1000000000) + 1),
      callback: function(response) {
        alert("✅ Payment Successful! Reference: " + response.reference);
        document.getElementById('paymentVerifiedBadge').style.display = 'block';
        switchAuthView('register');
      },
      onClose: function() {
        alert("⚠️ Payment process cancelled.");
      }
    });

    handler.openIframe();
  }

  function handleCreateDemoAccount() {
    const shopName = document.getElementById('demoShopName').value.trim() || "My Free Demo Store";
    const demoUsername = "demo_" + Math.floor(Math.random() * 10000);

    const demoUser = {
      username: demoUsername,
      password: "123",
      security: "demo",
      shopName: shopName,
      isDemo: true
    };

    users.push(demoUser);
    currentUser = demoUsername;
    
    inventory = [...demoPresetInventory];
    customers = [{ id: 101, name: "Kofi Mensah", phone: "024-000-0000" }];
    salesLog = [];
    securityPin = '1234';
    syncKey = '';
    connectedStores = [];
    currencySymbol = 'GH₵';
    shopAddress = 'Accra, Ghana';
    shopPhone = '+233 (0) 24 000 0000';
    receiptSerialCounter = 100001;

    saveData();
    alert(`🎉 Free Demo Shop Created!\nShop: ${shopName}`);
    closeAuthModal();
    showAppScreen();
  }

  function handleLogin() {
    const userIn = document.getElementById('loginUser').value.trim();
    const passIn = document.getElementById('loginPass').value;

    if (!userIn || !passIn) return alert("Please enter both username and password.");

    const match = users.find(u => u.username.toLowerCase() === userIn.toLowerCase() && u.password === passIn);
    if (match) {
      if (dbRef) dbRef.off();
      dbRef = null;
      currentUser = match.username;
      loadUserData();
      saveData();
      closeAuthModal();
      showAppScreen();
    } else {
      alert("❌ Invalid Username or Password!");
    }
  }

  function handleRegister() {
    const shopName = document.getElementById('regShopName').value.trim() || "Asetena Retail Store";
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const security = document.getElementById('regSecurity').value.trim();

    if (!username || !password || !security) return alert("Please fill out all registration fields.");

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return alert("⚠️ Username already exists. Please pick another.");
    }

    if (dbRef) dbRef.off();
    dbRef = null;

    users.push({ username, password, security, shopName, isDemo: false });
    currentUser = username;

    inventory = [];
    customers = [];
    salesLog = [];
    securityPin = '1234';
    syncKey = '';
    connectedStores = [];
    currencySymbol = 'GH₵';
    shopAddress = 'Accra, Ghana';
    shopPhone = '+233 (0) 24 000 0000';
    receiptSerialCounter = 100001;

    saveData();
    alert("🎉 Account created & subscription activated successfully!");
    closeAuthModal();
    showAppScreen();
  }

  function handleResetPassword() {
    const username = document.getElementById('recUser').value.trim();
    const security = document.getElementById('recSecurity').value.trim();
    const newPass = document.getElementById('recNewPass').value;

    if (!username || !security || !newPass) return alert("Please fill in all recovery fields.");

    const match = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.security.toLowerCase() === security.toLowerCase());
    if (match) {
      match.password = newPass;
      saveData();
      alert("✅ Password reset successfully!");
      switchAuthView('login');
      document.getElementById('loginUser').value = username;
    } else {
      alert("❌ Username or Security Answer is incorrect!");
    }
  }

  function handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
      if (dbRef) dbRef.off();
      dbRef = null;
      currentUser = null;
      inventory = []; customers = []; salesLog = []; cart = []; syncKey = ''; connectedStores = [];
      saveData();
      toggleSidebar(false);
      checkAuthState();
    }
  }

  function changeUsername() {
    const newName = prompt("Enter new username:", currentUser);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();

    if (users.some(u => u.username.toLowerCase() === trimmed.toLowerCase() && u.username !== currentUser)) {
      return alert("⚠️ Username is taken.");
    }

    const oldUser = currentUser;
    const userObj = users.find(u => u.username === oldUser);
    if (userObj) {
      userObj.username = trimmed;
      currentUser = trimmed;
      
      const oldStorageKey = (key) => `mb_store_${oldUser.toLowerCase()}_${key}`;
      ['inventory', 'customers', 'sales', 'security_pin', 'sync_key', 'connected_stores', 'currency', 'shop_address', 'shop_phone', 'receipt_serial'].forEach(key => {
        const val = localStorage.getItem(oldStorageKey(key));
        if (val !== null) {
          localStorage.setItem(getUserStorageKey(key), val);
          localStorage.removeItem(oldStorageKey(key));
        }
      });

      saveData();
      updateUserUI();
      alert("✅ Username updated!");
    }
  }

  function changeUserPassword() {
    const currentPass = prompt("Enter your current password:");
    const userObj = users.find(u => u.username === currentUser);

    if (!userObj || userObj.password !== currentPass) {
      return alert("❌ Incorrect password.");
    }

    const newPass = prompt("Enter new password:");
    if (!newPass || newPass.trim() === '') return alert("⚠️ Password cannot be empty.");

    userObj.password = newPass.trim();
    saveData();
    alert("✅ Password updated!");
  }

  function checkAuthState() {
    updateTimeGreeting();
    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.innerText = new Date().getFullYear();

    if (currentUser) {
      loadUserData();
      showAppScreen();
    } else {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('mainApp').style.display = 'none';
    }
  }

  function showAppScreen() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    updateUserUI();
    renderInventory();
    renderCustomers();
    renderCart();
    renderStats();
    renderSalesHistory();
    initFirebaseSync();
  }

  function updateUserUI() {
    const userObj = users.find(u => u.username.toLowerCase() === (currentUser || '').toLowerCase());
    const shopName = userObj ? (userObj.shopName || "Asetena Biz Suite") : "Asetena Biz Suite";
    const isDemo = isCurrentDemoAccount();

    document.getElementById('appStoreHeader').innerText = shopName + (isDemo ? " (Demo Shop)" : "");
    document.getElementById('receiptStoreName').innerText = shopName;
    document.getElementById('headerUserDisplay').innerText = `👤 ${currentUser}${isDemo ? ' [DEMO]' : ''}`;
    document.getElementById('accountInfoText').innerHTML = `Logged in as: <strong>${currentUser}</strong> ${isDemo ? '<span style="color:var(--warning); font-size:0.75rem;">(Demo Account)</span>' : ''}`;

    document.getElementById('currencySelector').value = currencySymbol;
    document.getElementById('settingShopAddress').value = shopAddress;
    document.getElementById('settingShopPhone').value = shopPhone;

    document.getElementById('demoBanner').style.display = isDemo ? 'flex' : 'none';

    ['sidebarSectionSync', 'sidebarSectionSecurity', 'sidebarSectionReset', 'sidebarSectionBackup', 'sidebarSectionCurrency'].forEach(secId => {
      const el = document.getElementById(secId);
      if (el) isDemo ? el.classList.add('demo-disabled-overlay') : el.classList.remove('demo-disabled-overlay');
    });

    const lockBadgeHTML = isDemo ? '<span style="color:var(--warning); font-size:0.75rem;">🔒 (Paid Feature)</span>' : '';
    document.getElementById('syncLockBadge').innerHTML = lockBadgeHTML;
    document.getElementById('securityLockBadge').innerHTML = lockBadgeHTML;
    document.getElementById('resetLockBadge').innerHTML = lockBadgeHTML;
    document.getElementById('backupLockBadge').innerHTML = lockBadgeHTML;
    document.getElementById('addLockBadge').innerHTML = lockBadgeHTML;

    const saveBtn = document.getElementById('saveProductBtn');
    if (saveBtn) saveBtn.disabled = isDemo;

    renderConnectedStores();
  }

  function connectLiveSyncWithPin(specificKey) {
    if (isCurrentDemoAccount()) return demoGuard();

    const pinCheck = prompt("🔒 Admin Verification Required:\nEnter admin security code to connect live store sync:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    connectLiveSync(specificKey);
  }

  function connectLiveSync(specificKey) {
    const keyToConnect = specificKey || document.getElementById('syncKeyInput').value.trim();
    if (!keyToConnect) return alert("Please enter a Sync Key name.");

    syncKey = keyToConnect.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!connectedStores.includes(syncKey)) {
      connectedStores.push(syncKey);
    }
    saveData();
    initFirebaseSync();
    renderConnectedStores();
  }

  function disconnectLiveSync() {
    if (!syncKey) return alert("No active sync connection to disconnect.");
    
    if (confirm(`Disconnect live sync from store key: "${syncKey}"?`)) {
      if (dbRef) dbRef.off();
      dbRef = null;
      syncKey = '';

      saveData();
      const badge = document.getElementById('syncBadge');
      badge.className = "sync-status sync-offline";
      badge.innerText = `Status: Offline / Local`;

      document.getElementById('syncKeyInput').value = '';
      renderConnectedStores();
      alert("🔌 Disconnected from Live Sync.");
    }
  }

  function removeConnectedStore(key) {
    connectedStores = connectedStores.filter(k => k !== key);
    if (syncKey === key) {
      disconnectLiveSync();
    } else {
      saveData();
      renderConnectedStores();
    }
  }

  function renderConnectedStores() {
    const container = document.getElementById('connectedStoreList');
    if (!container) return;

    if (connectedStores.length === 0) {
      container.innerHTML = '<p style="font-size:0.75rem; color:var(--text-muted); margin:0;">No stores connected yet.</p>';
      return;
    }

    let html = '';
    connectedStores.forEach(key => {
      const isCurrent = (key === syncKey);
      html += `
        <div class="store-item">
          <div>
            <span class="store-item-name">${key}</span>
            ${isCurrent ? '<span style="color:var(--accent); font-size:0.7rem; font-weight:bold; margin-left:4px;">● Active</span>' : ''}
          </div>
          <div style="display:flex; gap:4px;">
            ${!isCurrent ? `<button class="btn btn-small btn-secondary" onclick="demoGuard(() => connectLiveSyncWithPin('${key}'))">Connect</button>` : ''}
            <button class="btn btn-small btn-danger" onclick="demoGuard(() => removeConnectedStore('${key}'))">&times;</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  function initFirebaseSync() {
    if (!syncKey || !window.firebase) return;

    document.getElementById('syncKeyInput').value = syncKey;
    if (dbRef) dbRef.off();

    dbRef = firebase.database().ref('stores/' + syncKey);
    const badge = document.getElementById('syncBadge');
    badge.className = "sync-status sync-online";
    badge.innerText = `Sync Active: ${syncKey}`;

    dbRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        isRemoteSync = true;
        if (data.inventory) inventory = data.inventory;
        if (data.customers) customers = data.customers;
        if (data.salesLog) salesLog = data.salesLog;
        if (data.currencySymbol) currencySymbol = data.currencySymbol;

        saveData();
        renderInventory();
        renderCustomers();
        renderCart();
        renderStats();
        renderSalesHistory();
        isRemoteSync = false;
      }
    }, (error) => {
      badge.className = "sync-status sync-offline";
      badge.innerText = `Sync Failed`;
    });
  }

  function changeSecurityPin() {
    const currentPass = prompt("🔐 Enter current admin security code:");
    if (currentPass !== securityPin) return alert("❌ Incorrect security code.");

    const newPass = prompt("🔑 Enter new 4-digit security code:");
    if (!newPass || newPass.trim().length < 4) return alert("⚠️ PIN must be at least 4 digits.");

    securityPin = newPass.trim();
    saveData();
    alert("✅ Security code updated!");
  }

  function toggleSidebar(show) {
    document.getElementById('sidebarDrawer').classList.toggle('open', show);
    document.getElementById('sidebarOverlay').classList.toggle('open', show);
  }

  function toggleResetLock() {
    isResetUnlocked = !isResetUnlocked;
    const toggleBtn = document.getElementById('toggleResetBtn');
    const clearBtn = document.getElementById('clearAllDataBtn');

    toggleBtn.innerText = isResetUnlocked ? "Lock Reset Mode" : "Enable Reset Mode";
    toggleBtn.className = isResetUnlocked ? "btn btn-small btn-secondary" : "btn btn-small btn-warning";
    clearBtn.disabled = !isResetUnlocked;
  }

  function clearAllData() {
    if (!isResetUnlocked) return;

    const pinCheck = prompt("🚨 Enter admin security code to confirm clearing ALL System Data:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    if (confirm("FINAL WARNING: Are you absolutely sure? Wipes all store data.")) {
      if (currentUser) {
        ['inventory', 'customers', 'sales', 'security_pin', 'sync_key', 'connected_stores', 'currency', 'shop_address', 'shop_phone', 'receipt_serial'].forEach(key => {
          localStorage.removeItem(getUserStorageKey(key));
        });
      }
      inventory = []; customers = []; salesLog = []; cart = []; connectedStores = []; syncKey = '';
      currentUser = null;
      saveData(); renderInventory(); renderCustomers(); renderCart(); renderStats(); renderSalesHistory();
      toggleResetLock(); toggleSidebar(false); checkAuthState();
      alert("✅ Store data has been completely reset.");
    }
  }

  function exportFullJSON() {
    const jsonStr = JSON.stringify({ users, inventory, customers, salesLog, connectedStores, currencySymbol, shopAddress, shopPhone, receiptSerialCounter }, null, 2);
    const url = URL.createObjectURL(new Blob([jsonStr], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `AsetenaBiz_${currentUser || 'Store'}_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function importFullJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.inventory && data.customers && data.salesLog) {
          if (data.connectedStores) connectedStores = data.connectedStores;
          if (data.currencySymbol) currencySymbol = data.currencySymbol;
          if (data.shopAddress) shopAddress = data.shopAddress;
          if (data.shopPhone) shopPhone = data.shopPhone;
          if (data.receiptSerialCounter) receiptSerialCounter = data.receiptSerialCounter;
          inventory = data.inventory; customers = data.customers; salesLog = data.salesLog;
          saveData(); renderInventory(); renderCustomers(); renderCart(); renderStats(); renderSalesHistory(); renderConnectedStores();
          alert("Data successfully imported!"); toggleSidebar(false);
        } else alert("Invalid backup file format.");
      } catch (err) { alert("Error parsing file: " + err.message); }
    };
    reader.readAsText(file);
  }

  function toggleCardLock(id) {
    if (isCurrentDemoAccount()) return demoGuard();

    if (!unlockedCards[id]) {
      const inputPin = prompt("🔒 Enter admin security code to unlock and edit product:");
      if (inputPin === null) return;
      if (inputPin !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");
      unlockedCards[id] = true;
    } else {
      unlockedCards[id] = false;
    }
    renderInventory();
  }

  function renderInventory() {
    const grid = document.getElementById('productGrid');
    const query = (document.getElementById('productSearch')?.value || '').toLowerCase().trim();
    grid.innerHTML = '';

    const isDemo = isCurrentDemoAccount();
    let items = inventory.filter(item => item.name.toLowerCase().includes(query));
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (items.length === 0) return grid.innerHTML = `<p style="font-size:0.85rem; grid-column: 1/-1; color: var(--text-muted);">No items found.</p>`;

    items.forEach(item => {
      const isUnlocked = !isDemo && !!unlockedCards[item.id];
      const attr = (isUnlocked && !isDemo) ? '' : 'disabled';
      const label = isUnlocked ? '🔓 Lock' : '🔒 Unlock';
      const css = isUnlocked ? 'btn-secondary' : 'btn-small';

      let stockBadgeClass = 'badge-in';
      let stockBadgeText = `${item.stock} in stock`;
      if (item.stock === 0) {
        stockBadgeClass = 'badge-out';
        stockBadgeText = 'Out of Stock';
      } else if (item.stock <= 5) {
        stockBadgeClass = 'badge-low';
        stockBadgeText = `${item.stock} Low Stock`;
      }

      const el = document.createElement('div');
      el.className = 'product-card';
      el.innerHTML = `
        <div class="product-info" onclick="addToCart(${item.id})">
          <div class="product-name">${item.name}</div>
          <div class="product-price">${fmtCurr(item.price)}</div>
          <div class="product-stock"><span class="badge ${stockBadgeClass}">${stockBadgeText}</span></div>
        </div>
        <div class="product-actions">
          <button class="btn btn-small ${css}" onclick="toggleCardLock(${item.id})">${label}</button>
          <button class="btn btn-small btn-secondary" ${attr} onclick="editProduct(${item.id})">✏️ Edit</button>
          <button class="btn btn-small btn-danger" ${attr} onclick="deleteProduct(${item.id})">🗑️ Delete</button>
        </div>
      `;
      grid.appendChild(el);
    });
  }

  function addToCart(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;
    if (product.stock <= 0) return alert("❌ Item is out of stock!");

    const existing = cart.find(c => c.id === productId);
    if (existing) {
      if (existing.qty + 1 > product.stock) {
        return alert(`⚠️ Only ${product.stock} units available in stock.`);
      }
      existing.qty += 1;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
    }

    renderCart();
  }

  function updateCartQty(productId, qtyChange) {
    const itemIndex = cart.findIndex(c => c.id === productId);
    if (itemIndex === -1) return;

    const product = inventory.find(p => p.id === productId);
    const newQty = cart[itemIndex].qty + qtyChange;

    if (newQty <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      if (product && newQty > product.stock) {
        return alert(`⚠️ Maximum stock limit reached (${product.stock}).`);
      }
      cart[itemIndex].qty = newQty;
    }

    renderCart();
  }

  function clearCart() {
    cart = [];
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    list.innerHTML = '';

    if (cart.length === 0) {
      list.innerHTML = `<li style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">Cart is empty. Click a product to add.</li>`;
    } else {
      cart.forEach(item => {
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
          <div>
            <div style="font-weight:bold;">${item.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${fmtCurr(item.price)} x ${item.qty} = <strong>${fmtCurr(item.price * item.qty)}</strong></div>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="btn btn-small btn-secondary" onclick="updateCartQty(${item.id}, -1)">-</button>
            <span style="font-size:0.85rem; font-weight:bold; min-width:16px; text-align:center;">${item.qty}</span>
            <button class="btn btn-small btn-secondary" onclick="updateCartQty(${item.id}, 1)">+</button>
          </div>
        `;
        list.appendChild(li);
      });
    }

    renderCartSummary();
  }

  function getCartCalculations() {
    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const taxPercent = parseFloat(document.getElementById('cartTaxPercent')?.value) || 0;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const tendered = parseFloat(document.getElementById('cartAmountTendered')?.value) || 0;
    const change = Math.max(0, tendered - total);

    return { subtotal, taxPercent, taxAmount, total, tendered, change };
  }

  function renderCartSummary() {
    const calcs = getCartCalculations();

    document.getElementById('cartSubtotalDisplay').innerText = fmtCurr(calcs.subtotal);
    document.getElementById('cartTaxAmountDisplay').innerText = fmtCurr(calcs.taxAmount);
    document.getElementById('cartTotalDisplay').innerText = fmtCurr(calcs.total);
    document.getElementById('cartChangeDisplay').innerText = fmtCurr(calcs.change);
  }

  /* --- CHECKOUT CONFIRMATION PAGE LOGIC --- */
  function openCheckoutConfirmation() {
    if (cart.length === 0) return alert("⚠️ Your cart is empty! Add products to proceed.");

    const calcs = getCartCalculations();
    if (calcs.tendered > 0 && calcs.tendered < calcs.total) {
      if (!confirm(`⚠️ Amount Tendered (${fmtCurr(calcs.tendered)}) is less than total amount (${fmtCurr(calcs.total)}). Proceed anyway?`)) {
        return;
      }
    }

    const custSelect = document.getElementById('cartCustomer');
    const customerName = custSelect.options[custSelect.selectedIndex]?.text || "Walk-in Customer";

    // Build Cart Summary Table inside confirmation modal
    const detailsContainer = document.getElementById('confirmOrderDetails');
    let itemsHTML = `<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
      <thead>
        <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); text-align:left;">
          <th style="padding:4px 0;">Item</th>
          <th style="text-align:center; padding:4px 0;">Qty</th>
          <th style="text-align:right; padding:4px 0;">Price</th>
          <th style="text-align:right; padding:4px 0;">Total</th>
        </tr>
      </thead>
      <tbody>`;

    cart.forEach(item => {
      itemsHTML += `
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:6px 0;">${item.name}</td>
          <td style="text-align:center; padding:6px 0;">${item.qty}</td>
          <td style="text-align:right; padding:6px 0;">${fmtCurr(item.price)}</td>
          <td style="text-align:right; padding:6px 0; font-weight:bold;">${fmtCurr(item.price * item.qty)}</td>
        </tr>
      `;
    });
    itemsHTML += `</tbody></table>`;
    detailsContainer.innerHTML = itemsHTML;

    // Populate Modal Figures
    document.getElementById('confirmCustomerName').innerText = customerName;
    document.getElementById('confirmSubtotal').innerText = fmtCurr(calcs.subtotal);
    document.getElementById('confirmTax').innerText = `${fmtCurr(calcs.taxAmount)} (${calcs.taxPercent}%)`;
    document.getElementById('confirmTotal').innerText = fmtCurr(calcs.total);
    document.getElementById('confirmTendered').innerText = calcs.tendered > 0 ? fmtCurr(calcs.tendered) : "Exact Cash / N/A";
    document.getElementById('confirmChange').innerText = fmtCurr(calcs.change);

    // Show Confirmation Modal
    document.getElementById('checkoutConfirmModal').style.display = 'flex';
  }

  function closeCheckoutConfirmation() {
    document.getElementById('checkoutConfirmModal').style.display = 'none';
  }

  function processCheckout() {
    closeCheckoutConfirmation();

    const calcs = getCartCalculations();
    const custSelect = document.getElementById('cartCustomer');
    const customerName = custSelect.options[custSelect.selectedIndex]?.text || "Walk-in Customer";

    // Deduct stock
    cart.forEach(cartItem => {
      const invItem = inventory.find(i => i.id === cartItem.id);
      if (invItem) invItem.stock = Math.max(0, invItem.stock - cartItem.qty);
    });

    // Create Sale Transaction Object
    const receiptSerial = `REC-${receiptSerialCounter++}`;
    const txnId = `TXN-${Date.now()}`;
    const saleRecord = {
      id: txnId,
      serial: receiptSerial,
      date: new Date().toLocaleString(),
      dateISO: new Date().toISOString(),
      customer: customerName,
      items: [...cart],
      subtotal: calcs.subtotal,
      taxPercent: calcs.taxPercent,
      taxAmount: calcs.taxAmount,
      total: calcs.total,
      tendered: calcs.tendered,
      change: calcs.change
    };

    salesLog.unshift(saleRecord);
    saveData();

    // Render Receipt Modal
    renderReceipt(saleRecord);

    // Reset Cart & Inputs
    cart = [];
    document.getElementById('cartAmountTendered').value = '';
    document.getElementById('cartTaxPercent').value = '0';
    renderCart();
    renderInventory();
    renderStats();
    renderSalesHistory();
  }

  function renderReceipt(sale) {
    document.getElementById('rDate').innerText = `Date: ${sale.date}`;
    document.getElementById('rCustomer').innerText = `Customer: ${sale.customer}`;
    document.getElementById('rSerial').innerText = `Receipt #: ${sale.serial}`;
    document.getElementById('rTransactionId').innerText = `Ref: ${sale.id}`;

    const itemsBox = document.getElementById('rItems');
    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
      <thead>
        <tr style="border-bottom:1px solid #000; text-align:left;">
          <th>Qty</th><th>Item</th><th style="text-align:right;">Amt</th>
        </tr>
      </thead>
      <tbody>`;

    sale.items.forEach(i => {
      html += `<tr>
        <td style="vertical-align:top;">${i.qty}x</td>
        <td>${i.name}</td>
        <td style="text-align:right; vertical-align:top;">${(i.price * i.qty).toFixed(2)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    itemsBox.innerHTML = html;

    document.getElementById('rSubtotal').innerText = sale.subtotal.toFixed(2);
    document.getElementById('rTax').innerText = sale.taxAmount.toFixed(2);
    document.getElementById('rTotal').innerText = sale.total.toFixed(2);
    document.getElementById('rTendered').innerText = (sale.tendered || sale.total).toFixed(2);
    document.getElementById('rChange').innerText = sale.change.toFixed(2);

    // Generate Barcode
    try {
      JsBarcode("#receiptBarcode", sale.serial, {
        format: "CODE128",
        width: 1.5,
        height: 35,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });
    } catch(e) { console.error("Barcode Error", e); }

    document.getElementById('receiptModal').style.display = 'flex';
  }

  function closeReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
  }

  function saveReceiptPDF() {
    const element = document.getElementById('receiptContainer');
    const opt = {
      margin:       0.2,
      filename:     `Receipt_${document.getElementById('rSerial').innerText.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }

  function addCustomer() {
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();

    if (!name) return alert("Please enter customer name.");

    customers.push({ id: Date.now(), name, phone: phone || 'N/A' });
    saveData();
    renderCustomers();

    document.getElementById('cName').value = '';
    document.getElementById('cPhone').value = '';
  }

  function renderCustomers() {
    const list = document.getElementById('custList');
    const select = document.getElementById('cartCustomer');
    
    list.innerHTML = '';
    select.innerHTML = `<option value="">Walk-in Customer</option>`;

    if (customers.length === 0) {
      list.innerHTML = `<li style="font-size:0.8rem; color:var(--text-muted); padding:6px 0;">No saved customers.</li>`;
    } else {
      customers.forEach(c => {
        const li = document.createElement('li');
        li.className = 'cust-item';
        li.innerHTML = `<span><strong>${c.name}</strong> (${c.phone})</span><button class="btn btn-small btn-danger" onclick="deleteCustomer(${c.id})">&times;</button>`;
        list.appendChild(li);

        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = `${c.name} (${c.phone})`;
        select.appendChild(opt);
      });
    }
  }

  function deleteCustomer(id) {
    customers = customers.filter(c => c.id !== id);
    saveData();
    renderCustomers();
  }

  function saveProduct() {
    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);

    if (!name || isNaN(price) || isNaN(stock)) return alert("Please enter valid item details.");

    if (id) {
      const prod = inventory.find(p => p.id == id);
      if (prod) {
        prod.name = name;
        prod.price = price;
        prod.stock = stock;
      }
    } else {
      inventory.push({ id: Date.now(), name, price, stock });
    }

    saveData();
    resetForm();
    renderInventory();
  }

  function editProduct(id) {
    const prod = inventory.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('editProductId').value = prod.id;
    document.getElementById('pName').value = prod.name;
    document.getElementById('pPrice').value = prod.price;
    document.getElementById('pStock').value = prod.stock;

    document.getElementById('formTitle').innerText = "✏️ Edit Product Item";
    document.getElementById('saveProductBtn').innerText = "Update Item";
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
  }

  function resetForm() {
    document.getElementById('editProductId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pStock').value = '';

    document.getElementById('formTitle').innerHTML = `🔒➕ Add New Item <span id="addLockBadge"></span>`;
    document.getElementById('saveProductBtn').innerText = "Add Item";
    document.getElementById('cancelEditBtn').style.display = 'none';
  }

  function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
      inventory = inventory.filter(p => p.id !== id);
      delete unlockedCards[id];
      saveData();
      renderInventory();
    }
  }

  function clearAllStock() {
    const pinCheck = prompt("🚨 Admin Verification:\nEnter admin security code to clear ALL inventory items:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    if (confirm("Are you sure you want to remove all stock inventory items?")) {
      inventory = [];
      unlockedCards = {};
      saveData();
      renderInventory();
    }
  }

  function renderStats() {
    const todayStr = new Date().toDateString();
    let todayRev = 0;
    let todayItems = 0;

    salesLog.forEach(s => {
      if (new Date(s.dateISO || s.date).toDateString() === todayStr) {
        todayRev += (s.total || 0);
        (s.items || []).forEach(i => todayItems += (i.qty || 0));
      }
    });

    document.getElementById('totalRevenue').innerText = fmtCurr(todayRev);
    document.getElementById('itemsSold').innerText = todayItems;
  }

  function renderSalesHistory() {
    const container = document.getElementById('salesHistory');
    container.innerHTML = '';

    if (salesLog.length === 0) {
      return container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted);">No sales recorded yet.</p>`;
    }

    // Group sales by day
    const groups = {};
    salesLog.forEach(s => {
      const dayKey = new Date(s.dateISO || s.date).toDateString();
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(s);
    });

    Object.keys(groups).forEach((day, idx) => {
      const daySales = groups[day];
      const dayTotal = daySales.reduce((sum, s) => sum + s.total, 0);

      const groupEl = document.createElement('div');
      groupEl.className = 'day-group';

      const header = document.createElement('div');
      header.className = 'day-header';
      header.innerHTML = `<span>📅 ${day} (${daySales.length} Txns)</span><span>${fmtCurr(dayTotal)}</span>`;
      header.onclick = () => {
        const txns = groupEl.querySelector('.day-txns');
        txns.classList.toggle('open');
      };

      const txnsDiv = document.createElement('div');
      txnsDiv.className = `day-txns ${idx === 0 ? 'open' : ''}`;

      daySales.forEach(s => {
        const itemEl = document.createElement('div');
        itemEl.className = 'sales-item';
        itemEl.innerHTML = `
          <div>
            <strong>${s.serial}</strong> - ${s.customer}<br>
            <small style="color:var(--text-muted);">${s.items.length} items</small>
          </div>
          <div style="text-align:right;">
            <span style="color:var(--accent); font-weight:bold;">${fmtCurr(s.total)}</span><br>
            <button class="btn btn-small btn-secondary" style="padding:2px 5px; font-size:0.7rem;" onclick='renderReceipt(${JSON.stringify(s)})'>Receipt</button>
          </div>
        `;
        txnsDiv.appendChild(itemEl);
      });

      groupEl.appendChild(header);
      groupEl.appendChild(txnsDiv);
      container.appendChild(groupEl);
    });
  }

  function exportCSV() {
    if (salesLog.length === 0) return alert("No sales records to export!");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Receipt Serial,Transaction ID,Date,Customer,Items,Subtotal,Tax,Total,Tendered,Change\n";

    salesLog.forEach(s => {
      const itemDesc = (s.items || []).map(i => `${i.qty}x ${i.name}`).join('; ');
      csvContent += `"${s.serial}","${s.id}","${s.date}","${s.customer}","${itemDesc}",${s.subtotal},${s.taxAmount},${s.total},${s.tendered},${s.change}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Initialize on Load
  window.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
  });
