/********************************************************************************
 * app.js
 * App completa (único archivo) para ZONAPC re-hecha desde 0
 * Usando exclusivamente Firebase v11.8.1 modular (wrappers globales en index.html)
 *
 * Requisitos previos (ya definidos en index.html):
 * - window.ref(path)
 * - window.get(ref)
 * - window.set(ref, val)
 * - window.update(ref, val)
 * - window.push(ref)
 * - window.remove(ref)
 * - window.onValue(ref, cb)
 * - window.auth, window.onAuthStateChanged, window.signInWithEmailAndPassword, window.signOut (opcional)
 *
 * NOTA: Este archivo asume que init.js ya creó las ramas iniciales en la base.
 ********************************************************************************/

(() => {
  /* ---------------------------
     Utilidades
     --------------------------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const fmtMoney = n => {
    const num = Number(n) || 0;
    return "$" + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  };
  const nowObj = () => {
    const d = new Date();
    return {
      d,
      isoDate: d.toISOString().slice(0, 10), // YYYY-MM-DD
      displayDate: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`,
      displayDateTime: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} (${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")})`,
      dayOfMonth: d.getDate(),
      monthKey: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` // YYYY-MM
    };
  };
  const padId = (num, len = 6) => String(num).padStart(len, "0");
  const ticketIdFromCounter = (cnt) => `ID_${padId(cnt, 6)}`;

  /* ---------------------------
     DOM refs (IDs descritos por el HTML)
     --------------------------- */
  const sections = {
    cobro: $("#cobro"),
    movimientos: $("#movimientos"),
    historial: $("#historial"),
    stock: $("#stock"),
    sueltos: $("#sueltos"),
    cajeros: $("#cajeros"),
    config: $("#config")
  };
  const navButtons = $$(".nav-btn");

  // Cobrar area
  const loginModal = $("#login-modal");
  const loginUsuario = $("#login-usuario");
  const loginPass = $("#login-pass");
  const btnLogin = $("#btn-login");
  const loginMsg = $("#login-msg");

  const cobroControles = $("#cobro-controles");
  const cobroCantidad = $("#cobro-cantidad");
  const cobroCodigo = $("#cobro-codigo");
  const cobroProductos = $("#cobro-productos");
  const btnAddProduct = $("#btn-add-product");

  const btnDecrKg = $("#btn-decr-kg");
  const inputKgSuelto = $("#input-kg-suelto");
  const btnIncrKg = $("#btn-incr-kg");
  const cobroCodigoSuelto = $("#cobro-codigo-suelto");
  const cobroSueltos = $("#cobro-sueltos");
  const btnAddSuelto = $("#btn-add-suelto");

  const tablaCobro = $("#tabla-cobro tbody");
  const totalDiv = $("#total-div");
  const btnCobrar = $("#btn-cobrar");

  // Movimientos
  const filtroCajero = $("#filtroCajero");
  const btnTirarZ = $("#btn-tirar-z");
  const tablaMovimientos = $("#tabla-movimientos tbody");

  // Historial
  const tablaHistorial = $("#tabla-historial tbody");
  const historialInfo = $("#historial-info");

  // Stock
  const stockCodigo = $("#stock-codigo");
  const stockCantidad = $("#stock-cantidad");
  const btnAgregarStock = $("#agregar-stock");
  const btnBuscarStock = $("#buscar-stock");
  const tablaStock = $("#tabla-stock tbody");

  // Sueltos
  const sueltosCodigo = $("#sueltos-codigo");
  const sueltosKg = $("#sueltos-kg");
  const sueltosBtnDecr = $("#sueltos-btn-decr");
  const sueltosBtnIncr = $("#sueltos-btn-incr");
  const btnAgregarSuelto = $("#btn-agregar-suelto");
  const btnBuscarSuelto = $("#btn-buscar-suelto");
  const tablaSueltos = $("#tabla-sueltos tbody");

  // Cajeros
  const cajeroNro = $("#cajero-nro");
  const cajeroNombre = $("#cajero-nombre");
  const cajeroDni = $("#cajero-dni");
  const cajeroPass = $("#cajero-pass");
  const btnAgregarCajero = $("#agregar-cajero");
  const tablaCajeros = $("#tabla-cajeros tbody");

  // Config
  const configNombre = $("#config-nombre");
  const configPassActual = $("#config-pass-actual");
  const configPassNueva = $("#config-pass-nueva");
  const btnGuardarConfig = $("#guardar-config");
  const configMsg = $("#config-msg");
  const masterPassInput = $("#master-pass");
  const btnRestaurar = $("#btn-restaurar");

  // Header title
  const appTitle = $("#app-title");

  /* ---------------------------
     Estado de la app en memoria (cliente)
     --------------------------- */
  const state = {
    currentSection: "cobro",
    currentCajero: null, // { nro: "01", pass: "xxx", name: "X", dni: "..." }
    cart: [], // array of { type: 'stock'|'suelto', code, name, qtyOrKg, priceUnit, total }
    dbCache: {
      config: null,
      cajeros: {},
      stock: {},
      sueltos: {},
    }
  };

  /* ---------------------------
     Firebase paths helpers
     --------------------------- */
  const paths = {
    root: () => window.ref("/"),
    config: () => window.ref("/config"),
    cajeros: () => window.ref("/cajeros"),
    cajero: nro => window.ref(`/cajeros/${nro}`),
    stock: () => window.ref("/stock"),
    stockItem: code => window.ref(`/stock/${code}`),
    sueltos: () => window.ref("/sueltos"),
    sueltoItem: code => window.ref(`/sueltos/${code}`),
    movimientosForDate: dateISO => window.ref(`/movimientos/${dateISO}`),
    movimiento: (dateISO, id) => window.ref(`/movimientos/${dateISO}/${id}`),
    historialForMonth: monthKey => window.ref(`/historial/${monthKey}`),
    historialDate: (monthKey, dateISO) => window.ref(`/historial/${monthKey}/${dateISO}`),
    countersForDate: dateISO => window.ref(`/counters/${dateISO}`),
  };

  /* ---------------------------
     Inicialización y listeners sobre la DB (carga inicial + onValue para datos claves)
     --------------------------- */
  async function loadInitialData() {
    // config
    try {
      const snap = await window.get(paths.config());
      if (snap.exists()) {
        state.dbCache.config = snap.val();
        if (state.dbCache.config.shopName) appTitle.textContent = state.dbCache.config.shopName + " - Gestión Comercial V2.12.2";
      }
    } catch (err) {
      console.error("Error getting config:", err);
    }

    // cajeros, stock, sueltos: we'll set onValue to keep them live
    window.onValue(paths.cajeros(), snap => {
      const v = snap.exists() ? snap.val() : {};
      state.dbCache.cajeros = v || {};
      renderCajeros();
      populateLoginUsuario();
      populateFiltroCajero();
    });

    window.onValue(paths.stock(), snap => {
      const v = snap.exists() ? snap.val() : {};
      state.dbCache.stock = v || {};
      populateStockSelects();
      renderStockTable();
    });

    window.onValue(paths.sueltos(), snap => {
      const v = snap.exists() ? snap.val() : {};
      state.dbCache.sueltos = v || {};
      populateSueltoSelects();
      renderSueltosTable();
    });

    // cleanup older historial entries according to day 15 logic
    await cleanupHistorialByPolicy();
  }

  /* ---------------------------
     NAVIGATION
     --------------------------- */
  function showSection(name) {
    state.currentSection = name;
    Object.entries(sections).forEach(([k, el]) => {
      if (!el) return;
      if (k === name) el.classList.remove("hidden");
      else el.classList.add("hidden");
    });
    // focus behaviors
    if (name === "cobro") {
      // ensure login visible if no cajero
      if (!state.currentCajero) {
        showLoginModal();
      }
    }
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.dataset.section;
      showSection(sec);
    });
  });

  /* ---------------------------
     ADMIN / MASTER PASSWORD INITIAL LOCK
     - On first open, show modal requiring admin or master pass (1918 or 1409 default)
     - This blocks the entire UI until correct.
     --------------------------- */
  let initialAdminUnlocked = false;
  async function showLoginModal() {
    loginModal.classList.remove("hidden");
    // blur main by adding modal overlay style via .modal? index.html uses #login-modal inside section.
    // ensure cobroControles hidden until cajero logs in
    cobroControles.classList.add("hidden");
  }

  function hideLoginModal() {
    loginModal.classList.add("hidden");
  }

  btnLogin.addEventListener("click", async () => {
    const passVal = loginPass.value.trim();
    if (!passVal) {
      loginMsg.textContent = "Contraseña incorrecta";
      return;
    }
    try {
      // get config to compare admin/master passwords live
      const cfgSnap = await window.get(paths.config());
      const cfg = cfgSnap.exists() ? cfgSnap.val() : { passAdmin: "1918", masterPass: "1409" };
      if (passVal === String(cfg.passAdmin) || passVal === String(cfg.masterPass)) {
        initialAdminUnlocked = true;
        hideLoginModal();
        loginMsg.textContent = "";
        loginPass.value = "";
        // default section is cobro
        showSection("cobro");
      } else {
        loginMsg.textContent = "Contraseña incorrecta";
      }
    } catch (err) {
      console.error("Error checking admin pass:", err);
      loginMsg.textContent = "Contraseña incorrecta";
    }
  });

  /* ---------------------------
     CAJERO LOGIN (para cobrar)
     - loginUsuario select lists registered cajeros 01-99
     - cajero password checked against stored cajero.pass
     --------------------------- */
  function populateLoginUsuario() {
    // fill with keys 01..99 but only those present in DB? The app expects select with existing cajeros.
    loginUsuario.innerHTML = "";
    const cajeros = state.dbCache.cajeros || {};
    const keys = Object.keys(cajeros).sort();
    // If none, still provide empty
    keys.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      loginUsuario.appendChild(opt);
    });
    // ensure at least one option
    if (!loginUsuario.options.length) {
      for (let i = 1; i <= 99; i++) {
        const code = String(i).padStart(2, "0");
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = code;
        loginUsuario.appendChild(opt);
      }
    }
  }

  btnLogin.addEventListener("click", async (e) => {
    // above handles admin modal; this same button is used inside login modal for cajero login: differentiate by context
    // If initialAdminUnlocked is false, it's the admin unlock modal. If true and login modal still visible, it's cajero login.
    if (!initialAdminUnlocked) return; // handled earlier
    // cajero login
    const nro = loginUsuario.value;
    const pass = loginPass.value;
    if (!nro) {
      loginMsg.textContent = "Seleccione cajero";
      return;
    }
    const snap = await window.get(paths.cajero(nro));
    if (!snap.exists()) {
      loginMsg.textContent = "Cajero no existe";
      return;
    }
    const cj = snap.val();
    if (!cj || !cj.pass) {
      loginMsg.textContent = "Contraseña incorrecta";
      return;
    }
    if (String(cj.pass) !== String(pass)) {
      loginMsg.textContent = "Contraseña incorrecta";
      return;
    }
    // success
    state.currentCajero = { nro, ...cj };
    loginMsg.textContent = "";
    loginPass.value = "";
    hideLoginModal();
    cobroControles.classList.remove("hidden");
    populateCobroCantidad();
  });

  /* ---------------------------
     COBRAR: cantidad select and product selects management
     --------------------------- */
  function populateCobroCantidad() {
    cobroCantidad.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const opt = document.createElement("option");
      opt.value = String(i).padStart(2, "0");
      opt.textContent = String(i).padStart(2, "0");
      cobroCantidad.appendChild(opt);
    }
  }

  function populateStockSelects() {
    // fill cobroProductos and stock tables
    cobroProductos.innerHTML = `<option value="">Elija un Item</option>`;
    Object.entries(state.dbCache.stock || {}).forEach(([code, item]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${code} - ${item.name || "PRODUCTO NUEVO"} - ${fmtMoney(item.price || 0)}`;
      cobroProductos.appendChild(opt);
    });

    // stockCantidad select used for adding stock UI: fill 001..999
    stockCantidad.innerHTML = "";
    for (let i = 1; i <= 999; i++) {
      const opt = document.createElement("option");
      opt.value = String(i).padStart(3, "0");
      opt.textContent = String(i).padStart(3, "0");
      stockCantidad.appendChild(opt);
    }
  }

  function populateSueltoSelects() {
    cobroSueltos.innerHTML = `<option value="">Elija un Item (Sueltos)</option>`;
    Object.entries(state.dbCache.sueltos || {}).forEach(([code, item]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${code} - ${item.name || "PRODUCTO NUEVO"} - ${fmtMoney(item.price || 0)}`;
      cobroSueltos.appendChild(opt);
    });

    // cajero_nro select for cajeros management
    cajeroNro.innerHTML = "";
    for (let i = 1; i <= 99; i++) {
      const code = String(i).padStart(2, "0");
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code;
      cajeroNro.appendChild(opt);
    }
  }

  function populateFiltroCajero() {
    filtroCajero.innerHTML = `<option value="TODOS">TODOS</option>`;
    Object.keys(state.dbCache.cajeros || {}).sort().forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      filtroCajero.appendChild(opt);
    });
  }

  /* ---------------------------
     CART logic (tabla de cobro)
     --------------------------- */
  function addToCart(item) {
    // item: { type, code, name, qtyOrKg, priceUnit }
    item.total = Number(item.priceUnit) * Number(item.qtyOrKg);
    // If sueltos: price rule is percentage (e.g., 0.800 => 80%): the item.priceUnit stored should be base; For sueltos, treat priceUnit as multiplier of base price
    if (item.type === "suelto") {
      // assume priceUnit is the base price of the product in sueltos node, and qtyOrKg is multiplier (e.g., 0.800) — but per spec, inputKg like 0.800 corresponds to 80% of item price?
      // Actually spec: "Si es SUELTOS es según porcentaje, ejemplo 0.800 corresponde al 80% del precio del Item en SUELTOS y si es 1.200 corresponde al 120%"
      // So item.qtyOrKg is multiplier. For sueltos:
      item.total = Number(item.priceUnit) * Number(item.qtyOrKg);
    }
    // push to beginning (recent first)
    state.cart.unshift(item);
    renderCart();
  }

  function renderCart() {
    tablaCobro.innerHTML = "";
    let total = 0;
    state.cart.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const qtyCell = document.createElement("td");
      qtyCell.textContent = row.type === "stock" ? row.qtyOrKg : Number(row.qtyOrKg).toFixed(3);
      const nameCell = document.createElement("td");
      nameCell.textContent = row.name || row.code;
      const priceCell = document.createElement("td");
      priceCell.textContent = fmtMoney(row.priceUnit);
      const totalCell = document.createElement("td");
      totalCell.textContent = fmtMoney(row.total);
      const actionCell = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "Eliminar";
      delBtn.classList.add("btn-eliminar");
      delBtn.addEventListener("click", () => confirmDeleteCartItem(idx));
      actionCell.appendChild(delBtn);

      tr.appendChild(qtyCell);
      tr.appendChild(nameCell);
      tr.appendChild(priceCell);
      tr.appendChild(totalCell);
      tr.appendChild(actionCell);
      tablaCobro.appendChild(tr);
      total += Number(row.total);
    });
    totalDiv.textContent = `TOTAL: ${fmtMoney(total)}`;
    btnCobrar.classList.toggle("hidden", state.cart.length === 0);
  }

  function confirmDeleteCartItem(idx) {
    // require admin password modal
    const modal = createAdminPasswordModal(async (ok) => {
      if (!ok) return;
      // delete item
      state.cart.splice(idx, 1);
      renderCart();
    });
    document.body.appendChild(modal);
  }

  /* ---------------------------
     Add product handlers (stock & sueltos)
     --------------------------- */
  btnAddProduct.addEventListener("click", async () => {
    const selectedCode = cobroProductos.value;
    const qty = Number(cobroCantidad.value);
    if (!selectedCode) return;
    const snap = await window.get(paths.stockItem(selectedCode));
    if (!snap.exists()) {
      alert("Producto no existe en stock");
      return;
    }
    const item = snap.val();
    addToCart({
      type: "stock",
      code: selectedCode,
      name: item.name || "PRODUCTO NUEVO",
      qtyOrKg: qty,
      priceUnit: Number(item.price || 0)
    });
  });

  btnAddSuelto.addEventListener("click", async () => {
    const selectedCode = cobroSueltos.value;
    const kg = Number(inputKgSuelto.value);
    if (!selectedCode) return;
    const snap = await window.get(paths.sueltoItem(selectedCode));
    if (!snap.exists()) {
      alert("Producto no existe en sueltos");
      return;
    }
    const item = snap.val();
    // Here kg is a multiplier as per spec. But the inputKg is 0.100.. so value like 0.800 means 80%?
    addToCart({
      type: "suelto",
      code: selectedCode,
      name: item.name || "PRODUCTO NUEVO",
      qtyOrKg: kg.toFixed(3),
      priceUnit: Number(item.price || 0) // base price
    });
  });

  /* KG +/- for sueltos */
  btnIncrKg.addEventListener("click", () => {
    let val = Number(inputKgSuelto.value) || 0.0;
    val = Number((val + 0.1).toFixed(3));
    if (val > 99.9) val = 99.9;
    inputKgSuelto.value = val.toFixed(3);
  });
  btnDecrKg.addEventListener("click", () => {
    let val = Number(inputKgSuelto.value) || 0.0;
    val = Number((val - 0.1).toFixed(3));
    if (val < 0.1) val = 0.1;
    inputKgSuelto.value = val.toFixed(3);
  });

  /* ---------------------------
     COBRAR -> Payment flow
     - Open modal with payment method choices
     - On confirm: record movement, update stock/sueltos, print ticket, move to historial as well
     --------------------------- */
  btnCobrar.addEventListener("click", () => {
    const modal = createPaymentModal(async (method) => {
      if (!method) return;
      await finalizeSale(method);
    });
    document.body.appendChild(modal);
  });

  async function finalizeSale(paymentMethod) {
    if (!state.currentCajero) {
      alert("Debe iniciar sesión como cajero primero.");
      return;
    }
    if (!state.cart.length) return;

    // Build movement object
    const now = nowObj();
    const dateISO = now.isoDate;
    const countersRef = paths.countersForDate(dateISO);
    // read counter
    const cntSnap = await window.get(countersRef);
    let last = 0;
    if (cntSnap.exists() && cntSnap.val() && cntSnap.val().lastId) {
      last = Number(cntSnap.val().lastId);
    }
    const newCnt = last + 1;
    const ticketId = ticketIdFromCounter(newCnt); // ID_000001 etc

    // Save new counter
    await window.update(countersRef, { lastId: newCnt });

    // movement object
    let totalSale = 0;
    const products = [];
    for (const it of state.cart) {
      const entry = {
        type: it.type, // stock|suelto
        code: it.code,
        name: it.name,
        qtyOrKg: it.qtyOrKg,
        priceUnit: it.priceUnit,
        total: Number(it.total)
      };
      totalSale += Number(entry.total);
      products.push(entry);
    }

    const movement = {
      id: ticketId,
      createdAt: now.displayDateTime,
      timestamp: Date.now(),
      cajero: state.currentCajero.nro,
      products,
      total: totalSale,
      paymentMethod
    };

    // Save under movimientos/{dateISO}/{ticketId} and also copy to historial/{monthKey}/{dateISO}/{ticketId}
    const movRef = paths.movimientosForDate(dateISO);
    const movChildRef = window.ref(`/movimientos/${dateISO}/${ticketId}`);
    await window.set(movChildRef, movement);

    const monthKey = now.monthKey;
    const histDateRef = window.ref(`/historial/${monthKey}/${dateISO}/${ticketId}`);
    await window.set(histDateRef, movement);

    // Update stock & sueltos: subtract. If product not found continue
    for (const p of products) {
      if (p.type === "stock") {
        const sRef = paths.stockItem(p.code);
        const sSnap = await window.get(sRef);
        if (sSnap.exists()) {
          const sVal = sSnap.val();
          const currentQty = Number(sVal.cant || 0);
          const newQty = currentQty - Number(p.qtyOrKg);
          await window.update(sRef, { cant: Math.max(0, newQty) });
        }
      } else if (p.type === "suelto") {
        // sueltos stored with cant as kilos maybe with format 0.000
        const sRef = paths.sueltoItem(p.code);
        const sSnap = await window.get(sRef);
        if (sSnap.exists()) {
          const sVal = sSnap.val();
          const currentKg = Number(sVal.kg || sVal.cant || 0);
          // But our p.qtyOrKg was multiplier percentage in spec. The spec also said selling reduces sueltos according to kg—interpretation: If sueltos item has available kg, and input was e.g., 0.800 (kgs?) then subtract that amount
          const toSubtract = Number(p.qtyOrKg);
          const newKg = currentKg - toSubtract;
          await window.update(sRef, { kg: Math.max(0, newKg) });
        }
      }
    }

    // Print ticket
    const ticketHtml = generateTicketHtml(movement);
    await printTicket(ticketHtml);

    // Clear cart
    state.cart = [];
    renderCart();

    // Optionally show confirmation
    alert("venta realizada");

    // End
  }

  function generateTicketHtml(movement) {
    // Build compact ticket limited to 5cm width (the CSS in styles.css already sets print-area width 5cm).
    // We'll build simple HTML body inside a .print-area container with HR id "hr-ticket".
    let lines = [];
    lines.push(`<div id="texto-ticket-modal">${movement.id}</div>`);
    lines.push(`<div id="texto-ticket">${movement.createdAt}</div>`);
    lines.push(`<div id="texto-ticket">Cajero: ${movement.cajero}</div>`);
    lines.push(`<div id="hr-ticket"></div>`);
    movement.products.forEach(p => {
      const qty = p.type === "stock" ? `${p.qtyOrKg}` : `${Number(p.qtyOrKg).toFixed(3)}`;
      const unit = fmtMoney(p.priceUnit);
      const subtotal = fmtMoney(p.total);
      lines.push(`<div id="texto-ticket">${p.name} ${unit} (x${qty}) = ${subtotal}</div>`);
      lines.push(`<div id="hr-ticket"></div>`);
    });
    lines.push(`<div id="texto-ticket">TOTAL: ${fmtMoney(movement.total)}</div>`);
    lines.push(`<div id="texto-ticket">Pago: ${movement.paymentMethod}</div>`);

    return `<div class="print-area">${lines.join("")}</div>`;
  }

  async function printTicket(html) {
    // Open new small window and print
    const w = window.open("", "_blank", "toolbar=no,location=no,menubar=no");
    if (!w) {
      console.warn("Pop-up blocked: abrir en nueva ventana no permitido. Intentando print en la misma ventana.");
      // fallback: create hidden iframe? Simpler: open a new document in same window in a new tab
      const w2 = window.open();
      w2.document.write(`<html><head><title>Ticket</title><style>
        body{font-family: Arial, Helvetica, sans-serif; margin:0; padding:6px;}
        #hr-ticket{width:4.8cm;border:none;border-top:1px solid #000;margin:6px auto;}
        .print-area{width:5cm;}
        #texto-ticket{font-size:9px; text-align:center; margin:2px 0;}
        #texto-ticket-modal{font-size:11px; text-align:center; margin:4px 0;}
        </style></head><body>${html}</body></html>`);
      w2.document.close();
      w2.print();
      w2.close();
      return;
    }
    w.document.write(`<html><head><title>Ticket</title><style>
      body{font-family: Arial, Helvetica, sans-serif; margin:0; padding:6px;}
      #hr-ticket{width:4.8cm;border:none;border-top:1px solid #000;margin:6px auto;}
      .print-area{width:5cm;}
      #texto-ticket{font-size:9px; text-align:center; margin:2px 0;}
      #texto-ticket-modal{font-size:11px; text-align:center; margin:4px 0;}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.print();
    w.close();
  }

  /* ---------------------------
     Movimientos list: live listener & render (for today's date)
     - Also supports filter by cajero and actions: reimprimir, eliminar (requires admin pass)
     --------------------------- */
  async function renderMovementsForDate(dateISO = nowObj().isoDate) {
    const movRef = paths.movimientosForDate(dateISO);
    const snap = await window.get(movRef);
    tablaMovimientos.innerHTML = "";
    if (!snap.exists()) return;
    const all = snap.val();
    // Convert to array sorted by timestamp desc
    const arr = Object.values(all || {}).sort((a, b) => b.timestamp - a.timestamp);
    const filter = filtroCajero.value || "TODOS";
    for (const m of arr) {
      if (filter !== "TODOS" && m.cajero !== filter) continue;
      const tr = document.createElement("tr");
      const idTd = document.createElement("td");
      idTd.textContent = m.id;
      const totalTd = document.createElement("td");
      totalTd.textContent = fmtMoney(m.total);
      const tipoTd = document.createElement("td");
      tipoTd.textContent = m.paymentMethod;
      const actionTd = document.createElement("td");
      const reimp = document.createElement("button");
      reimp.textContent = "Reimprimir";
      reimp.classList.add("btn-ver");
      reimp.addEventListener("click", () => openReprintModal(m));
      const eliminar = document.createElement("button");
      eliminar.textContent = "Eliminar";
      eliminar.classList.add("btn-eliminar");
      eliminar.addEventListener("click", () => confirmDeleteMovement(dateISO, m.id, m));
      actionTd.appendChild(reimp);
      actionTd.appendChild(eliminar);
      tr.appendChild(idTd);
      tr.appendChild(totalTd);
      tr.appendChild(tipoTd);
      tr.appendChild(actionTd);
      tablaMovimientos.appendChild(tr);
    }
  }

  filtroCajero.addEventListener("change", () => renderMovementsForDate());

  function openReprintModal(movement) {
    const modal = createReprintModal(movement);
    document.body.appendChild(modal);
  }

  function confirmDeleteMovement(dateISO, movementId, movementObj) {
    const modal = createAdminPasswordModal(async (ok) => {
      if (!ok) return;
      // Delete movement from /movimientos/{date}/{id}
      await window.remove(paths.movimiento(dateISO, movementId));
      // Restore stock/sueltos amounts in movementObj.products
      for (const p of movementObj.products) {
        if (p.type === "stock") {
          const sRef = paths.stockItem(p.code);
          const sSnap = await window.get(sRef);
          if (sSnap.exists()) {
            const sVal = sSnap.val();
            const currentQty = Number(sVal.cant || 0);
            const newQty = currentQty + Number(p.qtyOrKg);
            await window.update(sRef, { cant: newQty });
          }
        } else if (p.type === "suelto") {
          const sRef = paths.sueltoItem(p.code);
          const sSnap = await window.get(sRef);
          if (sSnap.exists()) {
            const sVal = sSnap.val();
            const currentKg = Number(sVal.kg || sVal.cant || 0);
            const newKg = currentKg + Number(p.qtyOrKg);
            await window.update(sRef, { kg: newKg });
          }
        }
      }
      // Note: per spec, deleted movement remains in historial, so we don't remove it from historial
      renderMovementsForDate();
    });
    document.body.appendChild(modal);
  }

  /* ---------------------------
     Tirar Z
     - Moves all movimientos of the current date into historial (they are already mirrored when created)
     - For safety, we'll move (copy) and then remove movimientos node for that date
     - Requires admin confirmation (password)
     --------------------------- */
  btnTirarZ.addEventListener("click", () => {
    const modal = createAdminPasswordModal(async (ok) => {
      if (!ok) return;
      const dateISO = nowObj().isoDate;
      const movRef = paths.movimientosForDate(dateISO);
      const snap = await window.get(movRef);
      if (!snap.exists()) {
        alert("No hay movimientos para tirar Z hoy.");
        return;
      }
      // Movements are already mirrored in historial at creation time; here Tirar Z will remove movimientos for the day
      await window.remove(movRef);
      renderMovementsForDate();
      alert("Tirar Z completado. Movimientos del día removidos (no se pueden revertir).");
    });
    document.body.appendChild(modal);
  });

  /* ---------------------------
     Historial with day navigation
     - We will implement simple controls: showCurrentDay, prevDay, nextDay
     - The HTML doesn't include navigators; we'll implement basic prev/next by adding controls above table programmatically
     --------------------------- */
  // We'll add navigation UI elements inside #historial section top if not present
  function ensureHistorialNav() {
    const sec = sections.historial;
    if (!sec) return;
    if (!$("#historial-paginador")) {
      const nav = document.createElement("div");
      nav.id = "historial-paginador";
      nav.innerHTML = `
        <button id="hist-prev">&lt; Anterior</button>
        <div id="hist-dia-label">${nowObj().displayDate}</div>
        <button id="hist-next">Siguiente &gt;</button>
      `;
      sec.insertBefore(nav, sec.querySelector("table"));
    }
    // bottom nav
    if (!document.querySelector("#historial-paginador-bottom")) {
      const nav2 = document.createElement("div");
      nav2.id = "historial-paginador-bottom";
      nav2.innerHTML = `
        <button id="hist-prev-btm">&lt; Anterior</button>
        <div id="hist-dia-label-bottom">${nowObj().displayDate}</div>
        <button id="hist-next-btm">Siguiente &gt;</button>
      `;
      sec.appendChild(nav2);
    }
    // attach listeners
    const prev = $("#hist-prev");
    const next = $("#hist-next");
    const prevB = $("#hist-prev-btm");
    const nextB = $("#hist-next-btm");

    // shared state
    if (!state.histSelectedDate) state.histSelectedDate = nowObj().d;

    function renderLabel() {
      const d = state.histSelectedDate;
      const label = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
      $("#hist-dia-label").textContent = label;
      $("#hist-dia-label-bottom").textContent = label;
    }

    prev.onclick = () => {
      state.histSelectedDate.setDate(state.histSelectedDate.getDate() - 1);
      renderLabel();
      renderHistorialForDate(state.histSelectedDate);
    };
    next.onclick = () => {
      state.histSelectedDate.setDate(state.histSelectedDate.getDate() + 1);
      renderLabel();
      renderHistorialForDate(state.histSelectedDate);
    };
    prevB.onclick = prev.onclick;
    nextB.onclick = next.onclick;
    renderLabel();
    renderHistorialForDate(state.histSelectedDate);
  }

  async function renderHistorialForDate(dateObj) {
    if (!dateObj) dateObj = new Date();
    const iso = dateObj.toISOString().slice(0, 10);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,"0")}`;
    const snap = await window.get(paths.historialDate(monthKey, iso));
    tablaHistorial.innerHTML = "";
    if (!snap.exists()) return;
    const all = snap.val();
    const arr = Object.values(all || {}).sort((a, b) => b.timestamp - a.timestamp);
    for (const m of arr) {
      const tr = document.createElement("tr");
      const idTd = document.createElement("td"); idTd.textContent = m.id;
      const totalTd = document.createElement("td"); totalTd.textContent = fmtMoney(m.total);
      const tipoTd = document.createElement("td"); tipoTd.textContent = m.paymentMethod;
      const cajeroTd = document.createElement("td"); cajeroTd.textContent = m.cajero;
      const horaTd = document.createElement("td"); horaTd.textContent = m.createdAt;
      const actionTd = document.createElement("td");
      const reimp = document.createElement("button");
      reimp.textContent = "Reimprimir";
      reimp.classList.add("btn-ver");
      reimp.addEventListener("click", () => openReprintModal(m));
      actionTd.appendChild(reimp);

      tr.appendChild(idTd);
      tr.appendChild(totalTd);
      tr.appendChild(tipoTd);
      tr.appendChild(cajeroTd);
      tr.appendChild(horaTd);
      tr.appendChild(actionTd);
      tablaHistorial.appendChild(tr);
    }
  }

  /* ---------------------------
     Stock CRUD
     - Add stock: if product exists add quantity, else create with price 0 and default name "PRODUCTO NUEVO"
     - Edit/Delete require admin password modal
     --------------------------- */
  btnAgregarStock.addEventListener("click", async () => {
    const code = (stockCodigo.value || "").trim();
    const qty = Number(stockCantidad.value || 0);
    if (!code) return alert("Ingrese código");
    const refItem = paths.stockItem(code);
    const snap = await window.get(refItem);
    if (!snap.exists()) {
      const newItem = {
        name: "PRODUCTO NUEVO",
        cant: qty,
        price: 0,
        createdAt: nowObj().displayDateTime
      };
      await window.set(refItem, newItem);
    } else {
      const val = snap.val();
      const current = Number(val.cant || 0);
      await window.update(refItem, { cant: current + qty, updatedAt: nowObj().displayDateTime });
    }
    stockCodigo.value = "";
    renderStockTable();
  });

  btnBuscarStock.addEventListener("click", async () => {
    const q = (stockCodigo.value || "").trim().toLowerCase();
    renderStockTable(q);
  });

  function renderStockTable(query = "") {
    tablaStock.innerHTML = "";
    const stock = state.dbCache.stock || {};
    // Sort by created timestamp desc if exists; else by code
    const arr = Object.entries(stock).map(([code, v]) => ({ code, ...v }));
    arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    for (const item of arr) {
      if (query) {
        if (!(String(item.code).toLowerCase().includes(query) || String(item.name || "").toLowerCase().includes(query))) continue;
      }
      const tr = document.createElement("tr");
      const codeTd = document.createElement("td"); codeTd.textContent = item.code;
      const nameTd = document.createElement("td"); nameTd.textContent = item.name || "PRODUCTO NUEVO";
      const cantTd = document.createElement("td"); cantTd.textContent = item.cant || 0;
      const fechaTd = document.createElement("td"); fechaTd.textContent = item.createdAt || item.updatedAt || "";
      const precioTd = document.createElement("td"); precioTd.textContent = fmtMoney(item.price || 0);
      const actionTd = document.createElement("td");
      const editar = document.createElement("button"); editar.textContent = "Editar"; editar.classList.add("btn-guardar");
      editar.addEventListener("click", () => openEditStockModal(item));
      const eliminar = document.createElement("button"); eliminar.textContent = "Eliminar"; eliminar.classList.add("btn-eliminar");
      eliminar.addEventListener("click", () => {
        const modal = createAdminPasswordModal(async (ok) => {
          if (!ok) return;
          await window.remove(paths.stockItem(item.code));
          renderStockTable();
        });
        document.body.appendChild(modal);
      });
      actionTd.appendChild(editar);
      actionTd.appendChild(eliminar);

      tr.appendChild(codeTd); tr.appendChild(nameTd); tr.appendChild(cantTd); tr.appendChild(fechaTd); tr.appendChild(precioTd); tr.appendChild(actionTd);
      tablaStock.appendChild(tr);
    }
  }

  function openEditStockModal(item) {
    const modal = createFormModal("Editar Producto Stock", [
      { label: "Código", id: "edit-code", value: item.code, disabled: true },
      { label: "Nombre", id: "edit-name", value: item.name || "" },
      { label: "Cantidad", id: "edit-cant", value: item.cant || 0 },
      { label: "Precio", id: "edit-price", value: item.price || 0 }
    ], async (vals) => {
      // vals keyed by id
      const adminModal = createAdminPasswordModal(async (ok) => {
        if (!ok) return;
        await window.update(paths.stockItem(item.code), {
          name: vals["edit-name"],
          cant: Number(vals["edit-cant"]),
          price: Number(vals["edit-price"]),
          updatedAt: nowObj().displayDateTime
        });
      });
      document.body.appendChild(adminModal);
    });
    document.body.appendChild(modal);
  }

  /* ---------------------------
     Sueltos CRUD (similar to stock but kg and decimal 0.000)
     --------------------------- */
  btnAgregarSuelto.addEventListener("click", async () => {
    const code = (sueltosCodigo.value || "").trim();
    const kgVal = Number(sueltosKg.value || 0);
    if (!code) return alert("Ingrese código");
    const refItem = paths.sueltoItem(code);
    const snap = await window.get(refItem);
    if (!snap.exists()) {
      const newItem = {
        name: "PRODUCTO NUEVO",
        kg: kgVal,
        price: 0,
        createdAt: nowObj().displayDateTime
      };
      await window.set(refItem, newItem);
    } else {
      const val = snap.val();
      const current = Number(val.kg || val.cant || 0);
      await window.update(refItem, { kg: Number((current + kgVal).toFixed(3)), updatedAt: nowObj().displayDateTime });
    }
    sueltosCodigo.value = "";
    renderSueltosTable();
  });

  btnBuscarSuelto.addEventListener("click", async () => {
    const q = (sueltosCodigo.value || "").trim().toLowerCase();
    renderSueltosTable(q);
  });

  sueltosBtnIncr.addEventListener("click", () => {
    let v = Number(sueltosKg.value || 0);
    v = Number((v + 0.1).toFixed(3));
    if (v > 99.000) v = 99.000;
    sueltosKg.value = v.toFixed(3);
  });
  sueltosBtnDecr.addEventListener("click", () => {
    let v = Number(sueltosKg.value || 0);
    v = Number((v - 0.1).toFixed(3));
    if (v < 0.000) v = 0.000;
    sueltosKg.value = v.toFixed(3);
  });

  function renderSueltosTable(query = "") {
    tablaSueltos.innerHTML = "";
    const sueltos = state.dbCache.sueltos || {};
    const arr = Object.entries(sueltos).map(([code, v]) => ({ code, ...v }));
    arr.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
    for (const item of arr) {
      if (query) {
        if (!(String(item.code).toLowerCase().includes(query) || String(item.name||"").toLowerCase().includes(query))) continue;
      }
      const tr = document.createElement("tr");
      const codeTd = document.createElement("td"); codeTd.textContent = item.code;
      const nameTd = document.createElement("td"); nameTd.textContent = item.name || "PRODUCTO NUEVO";
      const kgTd = document.createElement("td"); kgTd.textContent = (Number(item.kg || item.cant || 0)).toFixed(3);
      const fechaTd = document.createElement("td"); fechaTd.textContent = item.createdAt || item.updatedAt || "";
      const precioTd = document.createElement("td"); precioTd.textContent = fmtMoney(item.price || 0);
      const actionTd = document.createElement("td");
      const editar = document.createElement("button"); editar.textContent = "Editar"; editar.classList.add("btn-guardar");
      editar.addEventListener("click", () => openEditSueltoModal(item));
      const eliminar = document.createElement("button"); eliminar.textContent = "Eliminar"; eliminar.classList.add("btn-eliminar");
      eliminar.addEventListener("click", () => {
        const modal = createAdminPasswordModal(async (ok) => {
          if (!ok) return;
          await window.remove(paths.sueltoItem(item.code));
          renderSueltosTable();
        });
        document.body.appendChild(modal);
      });
      actionTd.appendChild(editar);
      actionTd.appendChild(eliminar);

      tr.appendChild(codeTd); tr.appendChild(nameTd); tr.appendChild(kgTd); tr.appendChild(fechaTd); tr.appendChild(precioTd); tr.appendChild(actionTd);
      tablaSueltos.appendChild(tr);
    }
  }

  function openEditSueltoModal(item) {
    const modal = createFormModal("Editar Suelto", [
      { label: "Código", id: "edit-code-s", value: item.code, disabled: true },
      { label: "Nombre", id: "edit-name-s", value: item.name || "" },
      { label: "KG", id: "edit-kg-s", value: item.kg || item.cant || 0 },
      { label: "Precio", id: "edit-price-s", value: item.price || 0 }
    ], async (vals) => {
      const adminModal = createAdminPasswordModal(async (ok) => {
        if (!ok) return;
        await window.update(paths.sueltoItem(item.code), {
          name: vals["edit-name-s"],
          kg: Number(vals["edit-kg-s"]),
          price: Number(vals["edit-price-s"]),
          updatedAt: nowObj().displayDateTime
        });
      });
      document.body.appendChild(adminModal);
    });
    document.body.appendChild(modal);
  }

  /* ---------------------------
     Cajeros CRUD
     - Add requires admin password
     - Edit/Delete require admin
     - Validate constraints: DNI numeric 8 digits, pass length 4..12
     --------------------------- */
  btnAgregarCajero.addEventListener("click", () => {
    const nro = cajeroNro.value;
    const name = cajeroNombre.value.trim();
    const dni = cajeroDni.value.trim();
    const pass = cajeroPass.value;
    if (!name || !dni || !pass) {
      alert("Complete todos los campos");
      return;
    }
    if (!/^\d{8}$/.test(dni)) {
      alert("DNI debe tener 8 números");
      return;
    }
    if (pass.length < 4 || pass.length > 12) {
      alert("Contraseña debe tener entre 4 y 12 caracteres");
      return;
    }
    const modal = createAdminPasswordModal(async (ok) => {
      if (!ok) return;
      // set cajero
      const payload = { name, dni, pass, createdAt: nowObj().displayDateTime };
      await window.set(paths.cajero(nro), payload);
      cajeroNombre.value = "";
      cajeroDni.value = "";
      cajeroPass.value = "";
      renderCajeros();
    });
    document.body.appendChild(modal);
  });

  function renderCajeros() {
    tablaCajeros.innerHTML = "";
    const cajeros = state.dbCache.cajeros || {};
    const arr = Object.entries(cajeros).map(([n, v]) => ({ nro: n, ...v }));
    arr.sort((a,b) => Number(a.nro) - Number(b.nro));
    for (const c of arr) {
      const tr = document.createElement("tr");
      const nroTd = document.createElement("td"); nroTd.textContent = c.nro;
      const nameTd = document.createElement("td"); nameTd.textContent = c.name || "";
      const dniTd = document.createElement("td"); dniTd.textContent = c.dni || "";
      const actionTd = document.createElement("td");
      const editar = document.createElement("button"); editar.textContent = "Editar"; editar.classList.add("btn-guardar");
      editar.addEventListener("click", () => openEditCajeroModal(c));
      const eliminar = document.createElement("button"); eliminar.textContent = "Eliminar"; eliminar.classList.add("btn-eliminar");
      eliminar.addEventListener("click", () => {
        const modal = createAdminPasswordModal(async (ok) => {
          if (!ok) return;
          await window.remove(paths.cajero(c.nro));
          renderCajeros();
          populateLoginUsuario();
        });
        document.body.appendChild(modal);
      });
      actionTd.appendChild(editar);
      actionTd.appendChild(eliminar);
      tr.appendChild(nroTd); tr.appendChild(nameTd); tr.appendChild(dniTd); tr.appendChild(actionTd);
      tablaCajeros.appendChild(tr);
    }
  }

  function openEditCajeroModal(cajero) {
    const modal = createFormModal("Editar Cajero", [
      { label: "Nro", id: "edit-c-nro", value: cajero.nro, disabled: true },
      { label: "Nombre", id: "edit-c-name", value: cajero.name || "" },
      { label: "DNI", id: "edit-c-dni", value: cajero.dni || "" },
      { label: "Pass", id: "edit-c-pass", value: cajero.pass || "" }
    ], async (vals) => {
      const adminModal = createAdminPasswordModal(async (ok) => {
        if (!ok) return;
        await window.update(paths.cajero(cajero.nro), {
          name: vals["edit-c-name"],
          dni: vals["edit-c-dni"],
          pass: vals["edit-c-pass"],
          updatedAt: nowObj().displayDateTime
        });
      });
      document.body.appendChild(adminModal);
    });
    document.body.appendChild(modal);
  }

  /* ---------------------------
     Config: edit shop name, admin pass; restore by master pass
     --------------------------- */
  btnGuardarConfig.addEventListener("click", async () => {
    const actual = configPassActual.value.trim();
    const nueva = configPassNueva.value.trim();
    // check actual against DB admin pass
    const cfgSnap = await window.get(paths.config());
    const cfg = cfgSnap.exists() ? cfgSnap.val() : { passAdmin: "1918", masterPass: "1409" };
    if (String(actual) !== String(cfg.passAdmin)) {
      configMsg.textContent = "Contraseña incorrecta";
      return;
    }
    // update shop name and pass if provided
    const updates = {};
    if (configNombre.value.trim()) updates.shopName = configNombre.value.trim();
    if (nueva) {
      if (nueva.length < 4) {
        configMsg.textContent = "Nueva contraseña muy corta";
        return;
      }
      updates.passAdmin = nueva;
    }
    await window.update(paths.config(), updates);
    configMsg.textContent = "Guardado";
    // update title
    if (updates.shopName) appTitle.textContent = updates.shopName + " - Gestión Comercial V2.12.2";
    configPassActual.value = "";
    configPassNueva.value = "";
  });

  btnRestaurar.addEventListener("click", async () => {
    const master = masterPassInput.value.trim();
    const cfgSnap = await window.get(paths.config());
    const cfg = cfgSnap.exists() ? cfgSnap.val() : { passAdmin: "1918", masterPass: "1409" };
    if (String(master) !== String(cfg.masterPass)) {
      alert("Contraseña maestra incorrecta");
      return;
    }
    await window.update(paths.config(), { passAdmin: "1918" });
    alert("Contraseña restaurada a 1918");
    masterPassInput.value = "";
  });

  /* ---------------------------
     Helpers: create modals and small UI widgets
     --------------------------- */
  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    return overlay;
  }

  function createAdminPasswordModal(callback) {
    // callback(ok: boolean)
    const overlay = createOverlay();
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h3>Ingrese contraseña de administrador</h3>
      <input id="__adm_pass" type="password" placeholder="Contraseña"/>
      <div style="margin-top:8px;">
        <button id="__adm_ok" class="btn-guardar">Aceptar</button>
        <button id="__adm_cancel" class="btn-eliminar">Cancelar</button>
      </div>
      <p id="__adm_msg" style="color:red; font-weight:bold;"></p>
    `;
    overlay.appendChild(modal);
    overlay.querySelector("#__adm_cancel").addEventListener("click", () => {
      callback(false);
      document.body.removeChild(overlay);
    });
    overlay.querySelector("#__adm_ok").addEventListener("click", async () => {
      const val = overlay.querySelector("#__adm_pass").value;
      const cfgSnap = await window.get(paths.config());
      const cfg = cfgSnap.exists() ? cfgSnap.val() : { passAdmin: "1918", masterPass: "1409" };
      if (String(val) === String(cfg.passAdmin)) {
        callback(true);
        document.body.removeChild(overlay);
      } else {
        overlay.querySelector("#__adm_msg").textContent = "Contraseña incorrecta";
      }
    });
    return overlay;
  }

  function createPaymentModal(callback) {
    // callback(method) where method is string or null on cancel
    const overlay = createOverlay();
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h3>¿Cómo Pagará el Cliente?</h3>
      <div style="margin:8px;">
        <button class="pay-btn">Efectivo</button>
        <button class="pay-btn">Tarjeta</button>
        <button class="pay-btn">QR</button>
        <button class="pay-btn">Electrónico</button>
        <button class="pay-btn">Otro</button>
      </div>
      <div style="margin-top:8px;">
        <button id="pay-cancel" class="btn-eliminar">Cancelar</button>
      </div>
    `;
    overlay.appendChild(modal);
    modal.querySelectorAll(".pay-btn").forEach(b => {
      b.addEventListener("click", () => {
        const method = b.textContent;
        callback(method);
        document.body.removeChild(overlay);
      });
    });
    modal.querySelector("#pay-cancel").addEventListener("click", () => {
      callback(null);
      document.body.removeChild(overlay);
    });
    return overlay;
  }

  function createReprintModal(movement) {
    const overlay = createOverlay();
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h3>Ticket ${movement.id}</h3>
      <div style="max-height: 240px; overflow:auto; text-align:left; font-size:12px;">
      ${movement.products.map(p => `<div>${p.name} ${fmtMoney(p.priceUnit)} (x${p.qtyOrKg}) = ${fmtMoney(p.total)}</div>`).join("")}
      <div style="margin-top:8px;">TOTAL: ${fmtMoney(movement.total)}</div>
      </div>
      <div style="margin-top:8px;">
        <button id="reimprimir" class="btn-guardar">Reimprimir</button>
        <button id="reimprimir-cancel" class="btn-eliminar">Cancelar</button>
      </div>
    `;
    overlay.appendChild(modal);
    modal.querySelector("#reimprimir").addEventListener("click", async () => {
      const html = generateTicketHtml(movement);
      await printTicket(html);
      document.body.removeChild(overlay);
    });
    modal.querySelector("#reimprimir-cancel").addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
    return overlay;
  }

  function createFormModal(title, fields, onSubmit) {
    // fields: [{ label, id, value, disabled? }]
    const overlay = createOverlay();
    const modal = document.createElement("div");
    modal.className = "modal";
    const inner = document.createElement("div");
    inner.innerHTML = `<h3>${title}</h3>`;
    fields.forEach(f => {
      const wrapper = document.createElement("div");
      wrapper.style.margin = "6px 0";
      const label = document.createElement("div");
      label.textContent = f.label;
      const input = document.createElement("input");
      input.id = f.id;
      input.value = f.value || "";
      if (f.disabled) input.disabled = true;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      inner.appendChild(wrapper);
    });
    const buttons = document.createElement("div");
    buttons.style.marginTop = "8px";
    buttons.innerHTML = `<button id="form-ok" class="btn-guardar">Aceptar</button> <button id="form-cancel" class="btn-eliminar">Cancelar</button>`;
    inner.appendChild(buttons);
    modal.appendChild(inner);
    overlay.appendChild(modal);
    overlay.querySelector("#form-cancel").addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
    overlay.querySelector("#form-ok").addEventListener("click", () => {
      const vals = {};
      fields.forEach(f => {
        const el = overlay.querySelector(`#${f.id}`);
        vals[f.id] = el ? el.value : "";
      });
      onSubmit(vals);
      document.body.removeChild(overlay);
    });
    return overlay;
  }

  /* ---------------------------
     Historial cleanup policy (day 15 logic)
     - Behavior described in memory: keep previous month until day 15 of current month.
       After day 15 of current month, delete previous month's records.
     --------------------------- */
  async function cleanupHistorialByPolicy() {
    const now = nowObj();
    const day = now.dayOfMonth;
    if (day <= 15) {
      // keep previous month + current month days up to today (do nothing)
      return;
    }
    // day > 15: delete records of the month previous to current month
    const currentMonth = new Date(now.d.getFullYear(), now.d.getMonth(), 1);
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(currentMonth.getMonth() - 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,"0")}`;
    try {
      // remove entire prevKey under /historial
      await window.remove(paths.historialForMonth(prevKey));
      console.log("Historial: se eliminaron registros del mes anterior:", prevKey);
    } catch (err) {
      console.error("Error cleanup historial:", err);
    }
  }

  /* ---------------------------
     Misc helpers & initial render
     --------------------------- */
  function createInitialStaticUI() {
    // ensure selects with ranges are filled
    populateCobroCantidad();
    populateLoginUsuario();
    populateStockSelects();
    populateSueltoSelects();
    populateFiltroCajero();
    renderCart();
    renderStockTable();
    renderSueltosTable();
    renderCajeros();
    ensureHistorialNav();
    renderMovementsForDate();
  }

/* ---------------------------
   Start app
   --------------------------- */
(async () => {
  // sección por defecto
  showSection("cobro");

  // mostrar modal inicial que exige contraseña admin/maestra antes de permitir uso
  showLoginModal();

  // cargar datos iniciales y suscribirse a cambios
  await loadInitialData();

  // preparar UI estática y render inicial de tablas/selects
  createInitialStaticUI();

  // re-render periódico de movimientos para mantener la vista actualizada (fallback)
  const MOVEMENTS_REFRESH_INTERVAL_MS = 5000;
  setInterval(() => {
    try { renderMovementsForDate(); } catch (e) { console.warn("Error refrescando movimientos:", e); }
  }, MOVEMENTS_REFRESH_INTERVAL_MS);

  // proteger cierre accidental: opcional, comentado (descomentar si se desea)
  // window.addEventListener('beforeunload', (e) => {
  //   e.preventDefault();
  //   e.returnValue = '';
  // });

  console.log("App inicializada - Firebase v11.8.1 (modular)");
})();

/* ---------------------------
   Complemento final: listeners en vivo, scheduler de limpieza diaria y refuerzos
   (Este fragmento se añade al final del archivo, después del "Start app" async IIFE)
   --------------------------- */

(() => {
  // Listener en vivo para movimientos (cualquier cambio en /movimientos/* -> re-render)
  // Se suscribe al nodo raíz /movimientos para detectar cambios de cualquier fecha
  try {
    if (typeof window.onValue === "function") {
      window.onValue(window.ref("/movimientos"), () => {
        try { renderMovementsForDate(); } catch (e) { /* render safe */ }
      });
    }
  } catch (e) {
    console.warn("No se pudo subscribir a movimientos en vivo:", e);
  }

  // Scheduler: ejecutar cleanupHistorialByPolicy() a medianoche (server local del navegador) cada día
  function scheduleMidnightCleanup() {
    try {
      const now = new Date();
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0, 0) - now;
      // programar primer run un poco después de medianoche (00:05) para evitar edge cases
      setTimeout(async () => {
        try {
          await cleanupHistorialByPolicy();
        } catch (err) {
          console.error("Error en cleanupHistorialByPolicy (scheduled):", err);
        }
        // luego ejecutar a diario cada 24h
        setInterval(async () => {
          try {
            await cleanupHistorialByPolicy();
          } catch (err) {
            console.error("Error en cleanupHistorialByPolicy (interval):", err);
          }
        }, 24 * 60 * 60 * 1000);
      }, Math.max(0, msUntilMidnight));
    } catch (err) {
      console.warn("No se pudo programar cleanup diario:", err);
    }
  }

  // Refuerzo: si la app ya está inicializada, lanzar la programación
  try {
    scheduleMidnightCleanup();
  } catch (e) {
    console.warn("scheduleMidnightCleanup fallo:", e);
  }

  // Refuerzo: detectar cambios en /historial y actualizar vista si el usuario está en la sección historial
  try {
    if (typeof window.onValue === "function") {
      window.onValue(window.ref("/historial"), () => {
        try {
          if (state.currentSection === "historial") {
            // re-render the selected day in historial (if exists)
            if (state.histSelectedDate) renderHistorialForDate(state.histSelectedDate);
            else renderHistorialForDate(new Date());
          }
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) {
    console.warn("No se pudo subscribir a historial en vivo:", e);
  }

  // Small safety: if cart left open and no cajero, hide controls
  try {
    setInterval(() => {
      if (!state.currentCajero) {
        cobroControles.classList.add("hidden");
      }
    }, 3000);
  } catch (e) {
    /* ignore */
  }

  console.log("Enhancers iniciados: listeners en vivo y scheduler de limpieza diaria.");
})();
