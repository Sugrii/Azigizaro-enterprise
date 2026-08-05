
  // Replace with your Firebase Realtime Database URL
  const firebaseConfig = {
   // databaseURL: "https://azigizaro-enterprise-default-rtdb.firebaseio.com/"
  };

  // Replace with your Paystack Public Key from paystack.com
 // const PAYSTACK_PUBLIC_KEY = "pk_test_83ef5571585074d04c4e27091aa867e1db960ed6"; 

  let dbRef = null;
  let isRemoteSync = false;
  let syncKey = '';
  let connectedStores = [];
  let selectedPlanAmount = 50;
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

  // Helper: Get user-isolated key for local storage
  function getUserStorageKey(keyName) {
    const userClean = currentUser ? currentUser.toLowerCase().trim() : 'guest';
    return `mb_store_${userClean}_${keyName}`;
  }

  // Format amount with active currency symbol
  function fmtCurr(val) {
    const num = parseFloat(val) || 0;
    return `${currencySymbol} ${num.toFixed(2)}`;
  }

  // Newsletter Handler
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

  // Load User Data Namespace into Active State
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

    if (savedInventory !== null) {
      inventory = JSON.parse(savedInventory);
    } else {
      inventory = isDemo ? [...demoPresetInventory] : [];
    }

    if (savedCustomers !== null) {
      customers = JSON.parse(savedCustomers);
    } else {
      customers = isDemo ? [{ id: 101, name: "Kofi Mensah", phone: "024-000-0000" }] : [];
    }

    if (savedSales !== null) {
      salesLog = JSON.parse(savedSales);
    } else {
      salesLog = [];
    }

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

    if (hour >= 5 && hour < 12) {
      greeting = "Good Morning 🌅";
    } else if (hour >= 12 && hour < 17) {
      greeting = "Good Afternoon ☀️";
    } else if (hour >= 17 && hour < 22) {
      greeting = "Good Evening 🌙";
    } else {
      greeting = "Good Night 🌌";
    }

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

  // Modal Auth Controls
  function openAuthModal(view) {
    document.getElementById('authModal').style.display = 'flex';
    switchAuthView(view);
  }

  function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }

  function switchAuthView(view) {
    document.getElementById('demoForm').style.display = view === 'demo' ? 'flex' : 'none';
    document.getElementById('loginForm').style.display = view === 'login' ? 'flex' : 'none';
    document.getElementById('subscribeForm').style.display = view === 'subscribe' ? 'flex' : 'none';
    document.getElementById('registerForm').style.display = view === 'register' ? 'flex' : 'none';
    document.getElementById('forgotForm').style.display = view === 'forgot' ? 'flex' : 'none';

    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authSubtitle');

    if (view === 'demo') {
      title.innerText = "🎮 Create Free Demo Shop";
      subtitle.innerText = "Test out POS register, cart & receipt features instantly.";
    }
    if (view === 'login') {
      title.innerText = "🔐 Sign In";
      subtitle.innerText = "Welcome back! Enter credentials to access your store.";
    }
    if (view === 'subscribe') {
      title.innerText = "🚀 Subscribe to Asetena";
      subtitle.innerText = "Select a plan & complete Mobile Money payment to register.";
    }
    if (view === 'register') {
      title.innerText = "📝 Complete Registration";
      subtitle.innerText = "Set up your store name & login credentials.";
    }
    if (view === 'forgot') {
      title.innerText = "🔑 Recover Account";
      subtitle.innerText = "Reset your password with your security answer.";
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
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: selectedPlanAmount * 100,
      currency: "GHS",
      ref: 'AB_' + Math.floor((Math.random() * 1000000000) + 1),
      metadata: {
        custom_fields: [
          { display_name: "Full Name", variable_name: "full_name", value: fullName },
          { display_name: "Phone", variable_name: "phone", value: phone },
          { display_name: "Plan", variable_name: "plan", value: selectedPlanType }
        ]
      },
      callback: function(response) {
        alert("✅ Payment Successful! Transaction Ref: " + response.reference);
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
    const userName = document.getElementById('demoUserName').value.trim() || "Demo User";
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
    alert(`🎉 Free Demo Shop Created!\n\nShop Name: ${shopName}\nMode: Free Trial Demo`);
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
    alert("🎉 Account created & full store subscription activated successfully!");
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
      alert("✅ Password reset successfully! You can now log in.");
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
      return alert("⚠️ That username is taken.");
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
      alert("✅ Username updated successfully!");
    }
  }

  function changeUserPassword() {
    const currentPass = prompt("Enter your current password:");
    const userObj = users.find(u => u.username === currentUser);

    if (!userObj || userObj.password !== currentPass) {
      return alert("❌ Incorrect password.");
    }

    const newPass = prompt("Enter your new password:");
    if (!newPass || newPass.trim() === '') return alert("⚠️ Password cannot be empty.");

    userObj.password = newPass.trim();
    saveData();
    alert("✅ Password updated successfully!");
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

    const demoBanner = document.getElementById('demoBanner');
    demoBanner.style.display = isDemo ? 'flex' : 'none';

    const sidebarSections = ['sidebarSectionSync', 'sidebarSectionSecurity', 'sidebarSectionReset', 'sidebarSectionBackup', 'sidebarSectionCurrency'];
    sidebarSections.forEach(secId => {
      const el = document.getElementById(secId);
      if (el) {
        if (isDemo) el.classList.add('demo-disabled-overlay');
        else el.classList.remove('demo-disabled-overlay');
      }
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
      alert("🔌 Disconnected from Live Sync. Operating in Local Mode.");
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
        isRemoteSync = false;
      }
    }, (error) => {
      badge.className = "sync-status sync-offline";
      badge.innerText = `Sync Failed: Check Rules`;
    });
  }

  function changeSecurityPin() {
    const currentPass = prompt("🔐 Enter current admin security code:");
    if (currentPass !== securityPin) return alert("❌ Incorrect security code.");

    const newPass = prompt("🔑 Enter new 4-digit security code:");
    if (!newPass || newPass.trim().length < 4) return alert("⚠️ Invalid. PIN must be at least 4 digits.");

    securityPin = newPass.trim();
    saveData();
    alert("✅ Security code updated successfully!");
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

    const pinCheck = prompt("🚨 Enter admin security code to confirm completely clearing ALL System Data:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    if (confirm("FINAL WARNING: Are you absolutely sure? This will wipe your store data and reset back to landing page.")) {
      if (currentUser) {
        localStorage.removeItem(getUserStorageKey('inventory'));
        localStorage.removeItem(getUserStorageKey('customers'));
        localStorage.removeItem(getUserStorageKey('sales'));
        localStorage.removeItem(getUserStorageKey('security_pin'));
        localStorage.removeItem(getUserStorageKey('sync_key'));
        localStorage.removeItem(getUserStorageKey('connected_stores'));
        localStorage.removeItem(getUserStorageKey('currency'));
        localStorage.removeItem(getUserStorageKey('shop_address'));
        localStorage.removeItem(getUserStorageKey('shop_phone'));
        localStorage.removeItem(getUserStorageKey('receipt_serial'));
      }
      inventory = []; customers = []; salesLog = []; cart = []; connectedStores = []; syncKey = '';
      currentUser = null;
      saveData(); renderInventory(); renderCustomers(); renderCart(); renderStats();
      toggleResetLock(); toggleSidebar(false); checkAuthState();
      alert("✅ Store data has been successfully reset.");
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
          saveData(); renderInventory(); renderCustomers(); renderCart(); renderStats(); renderConnectedStores();
          alert("Data successfully imported!"); toggleSidebar(false);
        } else alert("Invalid backup file format.");
      } catch (err) { alert("Error parsing file: " + err.message); }
    };
    reader.readAsText(file);
  }

  function toggleCardLock(id) {
    if (isCurrentDemoAccount()) return demoGuard();

    if (!unlockedCards[id]) {
      const inputPin = prompt("🔒 Security Check:\nEnter admin security code to unlock and edit product:");
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

    if (items.length === 0) return grid.innerHTML = `<p style="font-size:0.85rem; grid-column: 1/-1;">No items found. Add items using the form below or connect a store.</p>`;

    items.forEach(item => {
      const isUnlocked = !isDemo && !!unlockedCards[item.id];
      const attr = (isUnlocked && !isDemo) ? '' : 'disabled';
      const label = isUnlocked ? '🔓 Lock' : '🔒 Unlock';
      const css = isUnlocked ? 'btn-secondary' : 'btn-small';

      const el = document.createElement('div');
      el.className = 'product-card';
      el.innerHTML = `
        <div class="product-info" onclick="addToCart(${item.id})">
          <div class="product-name">${item.name}</div>
          <div class="product-price">${fmtCurr(item.price)}</div>
          <div class="product-stock">
            <span class="badge ${item.stock===0?'badge-out':item.stock<=5?'badge-low':'badge-in'}">
              ${item.stock===0?'Sold Out':item.stock<=5?`Low (${item.stock})`:`Stock Bal: ${item.stock}`}
            </span>
          </div>
        </div>
        <div class="product-actions">
          <button class="btn btn-small ${css}" onclick="demoGuard(() => toggleCardLock(${item.id}))" style="width: 100%; margin-bottom: 4px;">${isDemo ? '🔒 Locked (Demo)' : label}</button>
          <button class="btn btn-small btn-warning" onclick="demoGuard(() => editProduct(${item.id}))" ${attr}>Edit</button>
          <button class="btn btn-small btn-danger" onclick="demoGuard(() => removeProduct(${item.id}))" ${attr}>Delete</button>
        </div>
      `;
      grid.appendChild(el);
    });
  }

  function saveProduct() {
    if (isCurrentDemoAccount()) return demoGuard();

    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);

    if (!name || isNaN(price) || isNaN(stock)) return alert('Fill out all item fields.');

    const pinCheck = prompt("🔒 Admin PIN Verification Required:\nEnter admin security code to add/update product:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    if (id) {
      const item = inventory.find(i => i.id == id);
      if (item) { item.name = name; item.price = price; item.stock = stock; }
    } else inventory.push({ id: Date.now(), name, price, stock });

    saveData(); renderInventory(); resetForm();
    alert("✅ Product saved successfully!");
  }

  function editProduct(id) {
    if (isCurrentDemoAccount()) return demoGuard();
    if (!unlockedCards[id]) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editProductId').value = item.id;
    document.getElementById('pName').value = item.name;
    document.getElementById('pPrice').value = item.price;
    document.getElementById('pStock').value = item.stock;

    document.getElementById('formTitle').innerText = '✏️ Edit Product';
    document.getElementById('saveProductBtn').innerText = 'Update Item';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
  }

  function removeProduct(id) {
    if (isCurrentDemoAccount()) return demoGuard();
    if (!unlockedCards[id]) return;
    if (confirm("Remove this product?")) {
      inventory = inventory.filter(i => i.id !== id);
      cart = cart.filter(c => c.id !== id);
      delete unlockedCards[id];
      saveData(); renderInventory(); renderCart();
    }
  }

  function resetForm() {
    document.getElementById('editProductId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pStock').value = '';
    document.getElementById('formTitle').innerText = '🔒➕ Add New Item';
    document.getElementById('saveProductBtn').innerText = 'Add Item';
    document.getElementById('cancelEditBtn').style.display = 'none';
  }

  function clearAllStock() {
    if (isCurrentDemoAccount()) return demoGuard();

    const pinCheck = prompt("🚨 Enter security code to confirm clearing ALL Product Stock:");
    if (pinCheck === null) return;
    if (pinCheck !== securityPin) return alert("❌ Access Denied: Incorrect Security Code!");

    if (confirm("Are you sure you want to clear all product stock?")) {
      inventory = []; cart = []; unlockedCards = {};
      saveData(); renderInventory(); renderCart();
    }
  }

  function renderCustomers() {
    const list = document.getElementById('custList'), select = document.getElementById('cartCustomer');
    list.innerHTML = ''; select.innerHTML = '<option value="">Walk-in Customer</option>';
    customers.forEach(c => {
      list.innerHTML += `<li class="cust-item"><span><strong>${c.name}</strong> (${c.phone})</span></li>`;
      select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
  }

  function addCustomer() {
    const name = document.getElementById('cName').value.trim(), phone = document.getElementById('cPhone').value.trim();
    if (!name || !phone) return alert('Provide name and phone.');
    customers.push({ id: Date.now(), name, phone });
    saveData(); renderCustomers(); document.getElementById('cName').value = ''; document.getElementById('cPhone').value = '';
  }

  function addToCart(pId) {
    const item = inventory.find(i => i.id === pId);
    if (!item || item.stock <= 0) return alert('Item sold out!');
    const inCart = cart.find(c => c.id === pId);
    if (inCart) {
      if (inCart.qty < item.stock) inCart.qty++; else alert('Max stock reached.');
    } else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    renderCart();
  }

  function clearCart() { 
    cart = []; 
    document.getElementById('cartAmountTendered').value = '';
    renderCart(); 
  }

  function renderCart() {
    const list = document.getElementById('cartList');
    list.innerHTML = '';
    if (cart.length === 0) { 
      list.innerHTML = '<li>Tap products on the right to add to cart</li>'; 
      renderCartSummary();
      return; 
    }

    cart.forEach(c => {
      list.innerHTML += `<li class="cart-item"><span>${c.name} (x${c.qty})</span><span>${fmtCurr(c.price * c.qty)}</span></li>`;
    });
    renderCartSummary();
  }

  function renderCartSummary() {
    let subtotal = 0;
    cart.forEach(c => { subtotal += (c.price * c.qty); });

    const taxPercent = parseFloat(document.getElementById('cartTaxPercent').value) || 0;
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;

    const tenderedInput = document.getElementById('cartAmountTendered').value;
    const tendered = parseFloat(tenderedInput) || 0;
    const change = tendered > 0 ? (tendered - grandTotal) : 0;

    document.getElementById('cartSubtotalDisplay').innerText = fmtCurr(subtotal);
    document.getElementById('cartTaxAmountDisplay').innerText = fmtCurr(taxAmount);
    document.getElementById('cartTotalDisplay').innerText = fmtCurr(grandTotal);

    const changeEl = document.getElementById('cartChangeDisplay');
    changeEl.innerText = fmtCurr(change >= 0 ? change : 0);
    changeEl.style.color = change < 0 ? 'var(--danger)' : 'var(--warning)';
  }

  function checkout() {
    if (cart.length === 0) return alert('Cart is empty.');
    
    const custName = document.getElementById('cartCustomer').value || 'Walk-in Customer';

    let subtotal = 0;
    cart.forEach(c => subtotal += (c.price * c.qty));

    const taxPercent = parseFloat(document.getElementById('cartTaxPercent').value) || 0;
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;

    const tenderedInput = document.getElementById('cartAmountTendered').value;
    const tendered = parseFloat(tenderedInput) || grandTotal;
    const change = tendered - grandTotal;

    if (tendered < grandTotal) {
      if (!confirm(`⚠️ Tendered amount (${fmtCurr(tendered)}) is less than total (${fmtCurr(grandTotal)}).\nProceed anyway?`)) {
        return;
      }
    }

    let confirmMsg = `🛒 CONFIRM SALE CHECKOUT\nCustomer: ${custName}\n-----------------------------------\n`;
    cart.forEach((item, idx) => {
      const lineTotal = item.price * item.qty;
      confirmMsg += `${idx + 1}. ${item.name} x${item.qty} @ ${fmtCurr(item.price)} = ${fmtCurr(lineTotal)}\n`;
    });
    confirmMsg += `-----------------------------------\nSubtotal: ${fmtCurr(subtotal)}\nTax (${taxPercent}%): ${fmtCurr(taxAmount)}\nGRAND TOTAL: ${fmtCurr(grandTotal)}\nTendered: ${fmtCurr(tendered)}\nChange: ${fmtCurr(change >= 0 ? change : 0)}\n\nProcess receipt now?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    let itemsCount = 0, receiptHTML = '', details = [];

    cart.forEach(c => {
      const invItem = inventory.find(i => i.id === c.id);
      if (invItem) invItem.stock -= c.qty;
      const lineTotal = c.price * c.qty;
      itemsCount += c.qty;
      details.push({ name: c.name, unitPrice: c.price, qty: c.qty, lineTotal });
      receiptHTML += `<div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px; color:#000;">
        <span>${c.name} (x${c.qty} @ ${fmtCurr(c.price)})</span><span>${fmtCurr(lineTotal)}</span></div>`;
    });

    const now = new Date();
    const timestamp = now.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const dateOnly = now.toLocaleDateString();
    const txnId = 'TXN-' + Date.now().toString().slice(-6);
    const serialNo = 'SN-' + receiptSerialCounter++;

    salesLog.unshift({ 
      txnId, 
      serialNo, 
      date: timestamp, 
      dateOnly, 
      customer: custName, 
      itemsCount, 
      itemsDetails: details, 
      subtotal,
      taxAmount,
      total: grandTotal, 
      tendered,
      change: change >= 0 ? change : 0,
      cashier: currentUser,
      currency: currencySymbol 
    });

    document.getElementById('rStoreAddress').innerText = shopAddress;
    document.getElementById('rStorePhone').innerText = `Tel: ${shopPhone}`;
    document.getElementById('rSerial').innerText = `Serial No: ${serialNo}`;
    document.getElementById('rTransactionId').innerText = `Receipt #: ${txnId} | Cashier: ${currentUser}`;
    document.getElementById('rDate').innerText = `Date: ${timestamp}`;
    document.getElementById('rCustomer').innerText = `Customer: ${custName}`;
    document.getElementById('rItems').innerHTML = receiptHTML;

    document.getElementById('rSubtotal').innerText = fmtCurr(subtotal);
    document.getElementById('rTax').innerText = fmtCurr(taxAmount);
    document.getElementById('rTotal').innerText = fmtCurr(grandTotal);
    document.getElementById('rTendered').innerText = fmtCurr(tendered);
    document.getElementById('rChange').innerText = fmtCurr(change >= 0 ? change : 0);

    // Generate Scannable Barcode
    if (window.JsBarcode) {
      try {
        JsBarcode("#receiptBarcode", txnId, {
          format: "CODE128",
          width: 1.5,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 2
        });
      } catch (err) { console.error("Barcode generation error:", err); }
    }

    document.getElementById('receiptModal').style.display = 'flex';

    cart = []; 
    document.getElementById('cartAmountTendered').value = '';
    saveData(); 
    renderInventory(); 
    renderCart(); 
    renderStats();
  }

  function saveReceiptPDF() {
    const element = document.getElementById('receiptContainer');
    
    if (window.html2pdf) {
      const opt = {
        margin:       0.2,
        filename:     `Receipt_${Date.now()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a6', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save().catch(err => {
        window.print();
      });
    } else {
      window.print();
    }
  }

  function closeReceipt() { document.getElementById('receiptModal').style.display = 'none'; }

  function renderStats() {
    const todayStr = new Date().toLocaleDateString();
    let todayRev = 0, todayCount = 0;
    const historyList = document.getElementById('salesHistory');
    historyList.innerHTML = '';

    const groupedData = {};

    salesLog.forEach(s => {
      const recordDate = s.dateOnly || s.date.split(',')[0].trim();

      if (recordDate === todayStr) {
        todayRev += (s.total || 0);
        todayCount += (s.itemsCount || 0);
      }

      if (!groupedData[recordDate]) groupedData[recordDate] = { total: 0, items: 0, txns: [] };
      groupedData[recordDate].total += (s.total || 0);
      groupedData[recordDate].items += (s.itemsCount || 0);
      groupedData[recordDate].txns.push(s);
    });

    document.getElementById('totalRevenue').innerText = fmtCurr(todayRev);
    document.getElementById('itemsSold').innerText = todayCount;

    if(Object.keys(groupedData).length === 0) {
      historyList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No recorded activities yet.</p>`;
    }

    Object.keys(groupedData).forEach(dateKey => {
      const day = groupedData[dateKey];
      const safeId = dateKey.replace(/[^a-zA-Z0-9]/g, '-');
      const isToday = (dateKey === todayStr);

      const groupDiv = document.createElement('div');
      groupDiv.className = 'day-group';
      
      const txnsHTML = day.txns.map(t => `
        <div class="sales-item">
          <span>${t.serialNo || t.txnId} - ${t.customer} (${t.itemsCount} items) [${t.cashier || 'System'}]</span>
          <span style="color: var(--accent); font-weight: bold;">+${fmtCurr(t.total || 0)}</span>
        </div>
      `).join('');

      groupDiv.innerHTML = `
        <div class="day-header" onclick="toggleDayGroup('${safeId}')">
          <span>📅 ${isToday ? 'Today' : dateKey} (${day.items} items sold)</span>
          <span>${fmtCurr(day.total)} ▼</span>
        </div>
        <div class="day-txns" id="day-log-${safeId}">
          ${txnsHTML}
        </div>
      `;
      
      historyList.appendChild(groupDiv);
    });
  }

  function toggleDayGroup(id) {
    const el = document.getElementById(`day-log-${id}`);
    if (el) el.classList.toggle('open');
  }

  function exportCSV() {
    if (salesLog.length === 0) return alert('No sales available to export.');
    let csv = "Serial No,Transaction ID,Date,Customer,Cashier,Product,Unit Price,Qty,Line Total,Subtotal,Tax,Transaction Total,Tendered,Change,Currency\n";
    salesLog.forEach(s => {
      const curr = s.currency || currencySymbol;
      if (s.itemsDetails?.length) {
        s.itemsDetails.forEach(i => {
          csv += `"${s.serialNo || ''}","${s.txnId}","${s.date}","${s.customer}","${s.cashier || 'System'}","${i.name}",${i.unitPrice},${i.qty},${i.lineTotal},${s.subtotal || s.total},${s.taxAmount || 0},${s.total},${s.tendered || s.total},${s.change || 0},"${curr}"\n`;
        });
      } else {
        csv += `"${s.serialNo || ''}","${s.txnId}","${s.date}","${s.customer}","${s.cashier || 'System'}","Summary",0,${s.itemsCount},${s.total},${s.subtotal || s.total},${s.taxAmount || 0},${s.total},${s.tendered || s.total},${s.change || 0},"${curr}"\n`;
      }
    });
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `Sales_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  checkAuthState();
