// app.js
import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

/* ---------------------------
   VARIABLES GLOBALES
--------------------------- */
const appSections = document.querySelectorAll("main section");
const navBtns = document.querySelectorAll(".nav-btn");
const appTitle = document.getElementById("app-title");

// Modal de contraseña inicial
const initAdminModal = document.createElement("div");
initAdminModal.id = "init-admin-modal";
initAdminModal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;";
initAdminModal.innerHTML = `
  <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;">
    <h2>Ingrese contraseña de administrador</h2>
    <input id="init-pass" type="password" placeholder="Contraseña" style="margin-bottom:10px;">
    <button id="init-btn">Ingresar</button>
    <p id="init-msg" style="color:red;margin-top:10px;"></p>
  </div>
`;
document.body.appendChild(initAdminModal);

/* ---------------------------
   ESTADO
--------------------------- */
let adminPass = "1918"; // por defecto
let masterPass = "1409";
let currentCajero = null;
let ticketsDiarios = {}; // tickets del día
let stockData = {};
let sueltosData = {};
let cajerosData = {};
let movimientosData = {};
let historialData = {};
let ticketCounter = 1; // se reinicia cada día

/* ---------------------------
   FUNCIONES GENERALES
--------------------------- */
const hideAllSections = () => appSections.forEach(s => s.classList.add("hidden"));
const showSection = (id) => {
    hideAllSections();
    document.getElementById(id).classList.remove("hidden");
};
navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        showSection(btn.dataset.section);
    });
});

// Helper formateo dinero
const formatMoney = n => `$${Number(n).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// Helper para fecha y hora
const fechaHora = () => {
    const d = new Date();
    const fecha = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const hora = `(${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')})`;
    return `${fecha} ${hora}`;
};

/* ---------------------------
   INICIO ADMIN
--------------------------- */
document.getElementById("init-btn").addEventListener("click", async ()=>{
    const pass = document.getElementById("init-pass").value.trim();
    if(pass === adminPass || pass === masterPass){
        initAdminModal.style.display="none";
        showSection("cobro");
        await cargarStock();
        await cargarSueltos();
        await cargarCajeros();
        cargarCajeroLogin();
    }else{
        document.getElementById("init-msg").innerText = "Contraseña incorrecta";
    }
});

/* ---------------------------
   COBRAR
--------------------------- */
const loginSelect = document.getElementById("login-usuario");
const loginPass = document.getElementById("login-pass");
const loginBtn = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");
const cobroControles = document.getElementById("cobro-controles");

loginBtn.addEventListener("click", ()=>{
    const cajeroNro = loginSelect.value;
    const pass = loginPass.value.trim();
    if(cajerosData[cajeroNro]?.pass === pass){
        currentCajero = cajeroNro;
        loginMsg.innerText="";
        cobroControles.classList.remove("hidden");
        document.getElementById("login-modal").classList.add("hidden");
    }else{
        loginMsg.innerText="Contraseña incorrecta";
    }
});

// Cargar select de cajeros para login
function cargarCajeroLogin(){
    loginSelect.innerHTML="";
    Object.keys(cajerosData).sort().forEach(nro=>{
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        loginSelect.appendChild(opt);
    });
}

// Select cantidad (01-99)
const cantSelect = document.getElementById("cobro-cantidad");
for(let i=1;i<=99;i++){
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = String(i).padStart(2,'0');
    cantSelect.appendChild(opt);
}

// Select productos STOCK y SUELTOS
const cobroProductos = document.getElementById("cobro-productos");
const cobroSueltos = document.getElementById("cobro-sueltos");
function actualizarSelectProductos(){
    cobroProductos.innerHTML='<option value="">Elija un Item</option>';
    Object.entries(stockData).forEach(([codigo,item])=>{
        const opt = document.createElement("option");
        opt.value=codigo;
        opt.textContent=item.nombre;
        cobroProductos.appendChild(opt);
    });
    cobroSueltos.innerHTML='<option value="">Elija un Item (Sueltos)</option>';
    Object.entries(sueltosData).forEach(([codigo,item])=>{
        const opt = document.createElement("option");
        opt.value=codigo;
        opt.textContent=item.nombre;
        cobroSueltos.appendChild(opt);
    });
}

// Tabla de cobro
const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
let cobroItems = [];

function renderTablaCobro(){
    tablaCobro.innerHTML="";
    let totalGeneral=0;
    cobroItems.forEach((item,index)=>{
        const tr = document.createElement("tr");
        const totalItem = item.tipo==="stock"?item.cantidad*item.precio:item.cantidad*item.precio*item.porcentaje;
        totalGeneral+=totalItem;
        tr.innerHTML=`
            <td>${item.cantidad}</td>
            <td>${item.nombre}</td>
            <td>${formatMoney(item.tipo==="stock"?item.precio:item.precio*item.porcentaje)}</td>
            <td>${formatMoney(totalItem)}</td>
            <td><button data-index="${index}" class="btn-elim-item">Eliminar</button></td>
        `;
        tablaCobro.appendChild(tr);
    });
    totalDiv.innerText = `TOTAL: ${formatMoney(totalGeneral)}`;
    document.querySelector("#btn-cobrar").classList.toggle("hidden", cobroItems.length===0);
}

// Agregar item STOCK
document.getElementById("btn-add-product").addEventListener("click",()=>{
    const codigo = document.getElementById("cobro-codigo").value.trim() || cobroProductos.value;
    if(!codigo || !stockData[codigo]) return;
    const cantidad = parseInt(document.getElementById("cobro-cantidad").value,10);
    cobroItems.unshift({tipo:"stock",codigo,nombre:stockData[codigo].nombre,cantidad,precio:stockData[codigo].precio});
    renderTablaCobro();
});

// Agregar item SUELTOS
const kgInput = document.getElementById("input-kg-suelto");
document.getElementById("btn-incr-kg").addEventListener("click",()=>{kgInput.value=(parseFloat(kgInput.value)+0.1).toFixed(3)});
document.getElementById("btn-decr-kg").addEventListener("click",()=>{kgInput.value=Math.max(0.100,parseFloat(kgInput.value)-0.1).toFixed(3)});

document.getElementById("btn-add-suelto").addEventListener("click",()=>{
    const codigo = document.getElementById("cobro-codigo-suelto").value.trim() || cobroSueltos.value;
    if(!codigo || !sueltosData[codigo]) return;
    const kg = parseFloat(kgInput.value);
    const porcentaje = kg; // según tu lógica: 0.800=80%, 1.200=120%
    cobroItems.unshift({tipo:"sueltos",codigo,nombre:sueltosData[codigo].nombre,cantidad:kg,precio:sueltosData[codigo].precio,porcentaje});
    renderTablaCobro();
});

// Eliminar item de tabla
tablaCobro.addEventListener("click", async e=>{
    if(e.target.classList.contains("btn-elim-item")){
        const index = e.target.dataset.index;
        const admin = prompt("Contraseña de administrador para eliminar item:");
        if(admin===adminPass){
            cobroItems.splice(index,1);
            renderTablaCobro();
        }else{
            alert("Contraseña incorrecta");
        }
    }
});

// Botón Cobrar
document.getElementById("btn-cobrar").addEventListener("click",()=>{
    const modal = document.createElement("div");
    modal.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:9999;";
    modal.innerHTML=`
        <div style="background:#fff;padding:20px;border-radius:10px;text-align:center;">
            <h2>¿Cómo pagará el Cliente?</h2>
            <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:10px 0;">
                <button class="pay-btn">Efectivo</button>
                <button class="pay-btn">Tarjeta</button>
                <button class="pay-btn">QR</button>
                <button class="pay-btn">Electrónico</button>
                <button class="pay-btn">Otro</button>
            </div>
            <button id="cancel-pay" style="background:red;color:#fff;">Cancelar</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#cancel-pay").addEventListener("click",()=>{modal.remove()});
    modal.querySelectorAll(".pay-btn").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const tipo = btn.innerText;
            realizarVenta(tipo);
            modal.remove();
        });
    });
});

function realizarVenta(tipo){
    // Crear ticket
    const ticketID = `ID_${String(ticketCounter).padStart(6,'0')}`;
    ticketCounter++;
    const total = cobroItems.reduce((a,b)=>a+(b.tipo==="stock"?b.cantidad*b.precio:b.cantidad*b.precio*b.porcentaje),0);
    const ticket = {
        id:ticketID,
        cajero:currentCajero,
        fecha:fechaHora(),
        tipoPago:tipo,
        items:[...cobroItems],
        total
    };
    // Guardar en movimientos y historial
    movimientosData[ticketID]=ticket;
    historialData[ticketID]=ticket;
    // Restar stock/sueltos
    cobroItems.forEach(it=>{
        if(it.tipo==="stock") stockData[it.codigo].cantidad-=it.cantidad;
        else sueltosData[it.codigo].cantidad-=it.cantidad;
    });
    // Imprimir ticket (ancho limitado)
    imprimirTicket(ticket);
    // Limpiar cobro
    cobroItems=[];
    renderTablaCobro();
    actualizarSelectProductos();
    alert("Venta realizada");
}

/* ---------------------------
   FUNCIONES DE CARGA DE DATOS
--------------------------- */
async function cargarStock(){
    const snap = await get(ref(window.db,"stock"));
    stockData = snap.exists()?snap.val():{};
    actualizarSelectProductos();
}

async function cargarSueltos(){
    const snap = await get(ref(window.db,"sueltos"));
    sueltosData = snap.exists()?snap.val():{};
    actualizarSelectProductos();
}

async function cargarCajeros(){
    const snap = await get(ref(window.db,"cajeros"));
    cajerosData = snap.exists()?snap.val():{};
    cargarCajeroLogin();
}

/* ---------------------------
   IMPRESIÓN DE TICKET
--------------------------- */
function imprimirTicket(ticket){
    const win = window.open("","Ticket","width=200,height=400");
    let html = `<pre style="width:5cm;font-family:monospace;">`;
    html+=`${ticket.id}\n${ticket.fecha}\nCajero: ${ticket.cajero}\n==========\n`;
    ticket.items.forEach(it=>{
        const totalItem = it.tipo==="stock"?it.cantidad*it.precio:it.cantidad*it.precio*it.porcentaje;
        html+=`${it.nombre} ${formatMoney(it.precio)} (x${it.cantidad}) = ${formatMoney(totalItem)}\n==========\n`;
    });
    html+=`TOTAL: ${formatMoney(ticket.total)}\nPago: ${ticket.tipoPago}\n`;
    html+="</pre>";
    win.document.write(html);
    win.document.close();
    win.print();
}

/* ---------------------------
   FIN APP
--------------------------- */
/* ---------------------------
   MOVIMIENTOS
--------------------------- */
const filtroCajero = document.getElementById("filtroCajero");
const tablaMovimientos = document.querySelector("#tabla-movimientos tbody");
const btnTirarZ = document.getElementById("btn-tirar-z");

// Cargar select de cajeros para filtro
function actualizarFiltroCajeros(){
    filtroCajero.innerHTML = '<option value="TODOS">TODOS</option>';
    Object.keys(cajerosData).sort().forEach(nro=>{
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        filtroCajero.appendChild(opt);
    });
}

// Render tabla movimientos
function renderMovimientos(){
    tablaMovimientos.innerHTML="";
    Object.values(movimientosData)
    .sort((a,b)=>b.id.localeCompare(a.id))
    .forEach(ticket=>{
        if(filtroCajero.value!=="TODOS" && ticket.cajero!==filtroCajero.value) return;
        const tr = document.createElement("tr");
        tr.innerHTML=`
            <td>${ticket.id}</td>
            <td>${formatMoney(ticket.total)}</td>
            <td>${ticket.tipoPago}</td>
            <td>
                <button class="reimp-btn" data-id="${ticket.id}">Reimprimir</button>
                <button class="elim-btn" data-id="${ticket.id}">Eliminar</button>
            </td>
        `;
        tablaMovimientos.appendChild(tr);
    });
}

// Reimprimir ticket desde MOVIMIENTOS
tablaMovimientos.addEventListener("click", e=>{
    if(e.target.classList.contains("reimp-btn")){
        const ticket = movimientosData[e.target.dataset.id];
        if(ticket) imprimirTicket(ticket);
    }
    if(e.target.classList.contains("elim-btn")){
        const pass = prompt("Contraseña administrador para eliminar ticket:");
        if(pass===adminPass){
            const ticket = movimientosData[e.target.dataset.id];
            if(ticket){
                // Restaurar stock/sueltos
                ticket.items.forEach(it=>{
                    if(it.tipo==="stock") stockData[it.codigo].cantidad+=it.cantidad;
                    else sueltosData[it.codigo].cantidad+=it.cantidad;
                });
                delete movimientosData[e.target.dataset.id];
                renderMovimientos();
                actualizarSelectProductos();
                alert("Ticket eliminado correctamente");
            }
        }else alert("Contraseña incorrecta");
    }
});

filtroCajero.addEventListener("change", renderMovimientos);
btnTirarZ.addEventListener("click", ()=>{
    if(confirm("⚠️ADVERTENCIA: Tirar Z no puede revertirse⚠️. Continuar?")){
        movimientosData={};
        renderMovimientos();
    }
});

/* ---------------------------
   HISTORIAL
--------------------------- */
const tablaHistorial = document.querySelector("#tabla-historial tbody");
let historialDia = new Date(); // día actual

function renderHistorial(){
    tablaHistorial.innerHTML="";
    const hoy = historialDia.toISOString().split("T")[0];
    Object.values(historialData)
    .sort((a,b)=>b.id.localeCompare(a.id))
    .forEach(ticket=>{
        const ticketDate = ticket.fecha.split(" ")[0].split("/").reverse().join("-");
        if(ticketDate!==hoy) return;
        const tr = document.createElement("tr");
        tr.innerHTML=`
            <td>${ticket.id}</td>
            <td>${formatMoney(ticket.total)}</td>
            <td>${ticket.tipoPago}</td>
            <td>${ticket.cajero}</td>
            <td>${ticket.fecha}</td>
            <td><button class="reimp-btn" data-id="${ticket.id}">Reimprimir</button></td>
        `;
        tablaHistorial.appendChild(tr);
    });
}

// Reimprimir desde historial
tablaHistorial.addEventListener("click", e=>{
    if(e.target.classList.contains("reimp-btn")){
        const ticket = historialData[e.target.dataset.id];
        if(ticket) imprimirTicket(ticket);
    }
});

/* ---------------------------
   STOCK
--------------------------- */
const tablaStock = document.querySelector("#tabla-stock tbody");
const stockCodigo = document.getElementById("stock-codigo");
const stockCantidad = document.getElementById("stock-cantidad");
const btnAgregarStock = document.getElementById("agregar-stock");
const btnBuscarStock = document.getElementById("buscar-stock");

// Cargar select cantidad
for(let i=1;i<=999;i++){
    const opt = document.createElement("option");
    opt.value=i;
    opt.textContent=String(i).padStart(3,'0');
    stockCantidad.appendChild(opt);
}

btnAgregarStock.addEventListener("click",()=>{
    const codigo = stockCodigo.value.trim();
    const cant = parseInt(stockCantidad.value,10);
    const pass = prompt("Contraseña administrador para agregar stock:");
    if(pass===adminPass){
        if(stockData[codigo]){
            stockData[codigo].cantidad+=cant;
        }else{
            stockData[codigo]={nombre:"PRODUCTO NUEVO",cantidad:cant,precio:0};
        }
        renderStock();
    }else alert("Contraseña incorrecta");
});

btnBuscarStock.addEventListener("click", renderStock);

function renderStock(){
    const filtro = stockCodigo.value.trim().toLowerCase();
    tablaStock.innerHTML="";
    Object.entries(stockData)
    .sort((a,b)=>b[1].fecha?.localeCompare(a[1].fecha)||0)
    .forEach(([codigo,item])=>{
        if(filtro && !codigo.includes(filtro) && !item.nombre.toLowerCase().includes(filtro)) return;
        const tr = document.createElement("tr");
        tr.innerHTML=`
            <td>${codigo}</td>
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td>${item.fecha||fechaHora()}</td>
            <td>${formatMoney(item.precio)}</td>
            <td>
                <button class="edit-stock" data-codigo="${codigo}">Editar</button>
                <button class="del-stock" data-codigo="${codigo}">Eliminar</button>
            </td>
        `;
        tablaStock.appendChild(tr);
    });
}

// Editar/Eliminar stock
tablaStock.addEventListener("click", e=>{
    const codigo = e.target.dataset.codigo;
    if(e.target.classList.contains("edit-stock")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        const nombre = prompt("Nuevo nombre:", stockData[codigo].nombre);
        const precio = parseFloat(prompt("Nuevo precio:", stockData[codigo].precio)) || 0;
        const cant = parseInt(prompt("Nueva cantidad:", stockData[codigo].cantidad)) || 0;
        stockData[codigo]={nombre,precio,cantidad:cant,fecha:fechaHora()};
        renderStock();
        actualizarSelectProductos();
    }
    if(e.target.classList.contains("del-stock")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        delete stockData[codigo];
        renderStock();
        actualizarSelectProductos();
    }
});

/* ---------------------------
   SUELTOS
--------------------------- */
const tablaSueltos = document.querySelector("#tabla-sueltos tbody");
const sueltosCodigo = document.getElementById("sueltos-codigo");
const sueltosKg = document.getElementById("sueltos-kg");
const btnIncrSueltos = document.getElementById("sueltos-btn-incr");
const btnDecrSueltos = document.getElementById("sueltos-btn-decr");
const btnAgregarSuelto = document.getElementById("btn-agregar-suelto");
const btnBuscarSuelto = document.getElementById("btn-buscar-suelto");

btnIncrSueltos.addEventListener("click",()=>{sueltosKg.value=(parseFloat(sueltosKg.value)+0.100).toFixed(3)});
btnDecrSueltos.addEventListener("click",()=>{sueltosKg.value=Math.max(0,parseFloat(sueltosKg.value)-0.100).toFixed(3)});

btnAgregarSuelto.addEventListener("click",()=>{
    const codigo = sueltosCodigo.value.trim();
    const kg = parseFloat(sueltosKg.value);
    const pass = prompt("Contraseña administrador:");
    if(pass!==adminPass) return alert("Contraseña incorrecta");
    if(sueltosData[codigo]){
        sueltosData[codigo].cantidad+=kg;
    }else{
        sueltosData[codigo]={nombre:"PRODUCTO NUEVO",cantidad:kg,precio:0};
    }
    renderSueltos();
    actualizarSelectProductos();
});

btnBuscarSuelto.addEventListener("click", renderSueltos);

function renderSueltos(){
    const filtro = sueltosCodigo.value.trim().toLowerCase();
    tablaSueltos.innerHTML="";
    Object.entries(sueltosData)
    .sort((a,b)=>b[1].fecha?.localeCompare(a[1].fecha)||0)
    .forEach(([codigo,item])=>{
        if(filtro && !codigo.includes(filtro) && !item.nombre.toLowerCase().includes(filtro)) return;
        const tr = document.createElement("tr");
        tr.innerHTML=`
            <td>${codigo}</td>
            <td>${item.nombre}</td>
            <td>${item.cantidad.toFixed(3)}</td>
            <td>${item.fecha||fechaHora()}</td>
            <td>${formatMoney(item.precio)}</td>
            <td>
                <button class="edit-suelto" data-codigo="${codigo}">Editar</button>
                <button class="del-suelto" data-codigo="${codigo}">Eliminar</button>
            </td>
        `;
        tablaSueltos.appendChild(tr);
    });
}

// Editar/Eliminar SUELTOS
tablaSueltos.addEventListener("click", e=>{
    const codigo = e.target.dataset.codigo;
    if(e.target.classList.contains("edit-suelto")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        const nombre = prompt("Nuevo nombre:", sueltosData[codigo].nombre);
        const precio = parseFloat(prompt("Nuevo precio:", sueltosData[codigo].precio)) || 0;
        const kg = parseFloat(prompt("Nueva cantidad:", sueltosData[codigo].cantidad)) || 0;
        sueltosData[codigo]={nombre,precio,cantidad:kg,fecha:fechaHora()};
        renderSueltos();
        actualizarSelectProductos();
    }
    if(e.target.classList.contains("del-suelto")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        delete sueltosData[codigo];
        renderSueltos();
        actualizarSelectProductos();
    }
});

/* ---------------------------
   CAJEROS
--------------------------- */
const cajeroNro = document.getElementById("cajero-nro");
const cajeroNombre = document.getElementById("cajero-nombre");
const cajeroDni = document.getElementById("cajero-dni");
const cajeroPass = document.getElementById("cajero-pass");
const tablaCajeros = document.querySelector("#tabla-cajeros tbody");
const btnAgregarCajero = document.getElementById("agregar-cajero");

// Select Nro Cajero
for(let i=1;i<=99;i++){
    const opt = document.createElement("option");
    opt.value=String(i).padStart(2,'0');
    opt.textContent=String(i).padStart(2,'0');
    cajeroNro.appendChild(opt);
}

btnAgregarCajero.addEventListener("click",()=>{
    const nro = cajeroNro.value;
    const nombre = cajeroNombre.value.trim();
    const dni = cajeroDni.value.trim();
    const pass = cajeroPass.value.trim();
    const admin = prompt("Contraseña administrador:");
    if(admin!==adminPass) return alert("Contraseña incorrecta");
    cajerosData[nro]={nombre,dni,pass};
    renderCajeros();
    cargarCajeroLogin();
});

function renderCajeros(){
    tablaCajeros.innerHTML="";
    Object.entries(cajerosData)
    .sort((a,b)=>a[0]-b[0])
    .forEach(([nro, c])=>{
        const tr = document.createElement("tr");
        tr.innerHTML=`
            <td>${nro}</td>
            <td>${c.nombre}</td>
            <td>${c.dni}</td>
            <td>
                <button class="edit-cajero" data-nro="${nro}">Editar</button>
                <button class="del-cajero" data-nro="${nro}">Eliminar</button>
            </td>
        `;
        tablaCajeros.appendChild(tr);
    });
}

tablaCajeros.addEventListener("click", e=>{
    const nro = e.target.dataset.nro;
    if(e.target.classList.contains("edit-cajero")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        const nombre = prompt("Nuevo nombre:", cajerosData[nro].nombre);
        const dni = prompt("Nuevo DNI:", cajerosData[nro].dni);
        const password = prompt("Nueva contraseña:", cajerosData[nro].pass);
        cajerosData[nro]={nombre,dni,pass:password};
        renderCajeros();
        cargarCajeroLogin();
    }
    if(e.target.classList.contains("del-cajero")){
        const pass = prompt("Contraseña administrador:");
        if(pass!==adminPass) return alert("Contraseña incorrecta");
        delete cajerosData[nro];
        renderCajeros();
        cargarCajeroLogin();
    }
});

/* ---------------------------
   CONFIG
--------------------------- */
const configNombre = document.getElementById("config-nombre");
const passActual = document.getElementById("config-pass-actual");
const passNueva = document.getElementById("config-pass-nueva");
const btnGuardarConfig = document.getElementById("guardar-config");
const masterInput = document.getElementById("master-pass");
const btnRestaurar = document.getElementById("btn-restaurar");

btnGuardarConfig.addEventListener("click",()=>{
    if(passActual.value!==adminPass) return alert("Contraseña incorrecta");
    if(configNombre.value.trim()) appTitle.textContent=configNombre.value.trim();
    if(passNueva.value.trim()) adminPass=passNueva.value.trim();
    alert("Configuración guardada");
});

btnRestaurar.addEventListener("click",()=>{
    if(masterInput.value===masterPass){
        adminPass="1918";
        alert("Contraseña de administrador restaurada");
    }else alert("Contraseña incorrecta");
});

/* ---------------------------
   INICIALIZAR
--------------------------- */
renderMovimientos();
renderHistorial();
renderStock();
renderSueltos();
renderCajeros();
actualizarFiltroCajeros();
/*****************************************************
 * AUTO-MAINTENANCE: limpieza historial (día 15) y
 * reseteo diario de contador de tickets
 * Añadir al final de app.js (se ejecuta ahora y queda programado)
 *****************************************************/
(async () => {
  // Helper fechas
  const hoyObj = () => {
    const d = new Date();
    return {
      d,
      day: d.getDate(),
      isoDate: d.toISOString().slice(0, 10), // YYYY-MM-DD
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, // YYYY-MM
      prevMonthKey() {
        const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
      }
    };
  };

  // Ruta helpers (ajustar si tu estructura DB difiere)
  const dbPaths = {
    historialMonth: (monthKey) => window.ref(`/historial/${monthKey}`),
    countersForDate: (isoDate) => window.ref(`/counters/${isoDate}`)
  };

  // Limpieza: eliminar mes anterior cuando día > 15
  async function cleanupHistorialByPolicy() {
    try {
      const now = hoyObj();
      if (now.day <= 15) {
        console.log("cleanupHistorialByPolicy: día <= 15 -> no se elimina mes anterior");
        return;
      }
      const prevKey = now.prevMonthKey();
      const prevRef = dbPaths.historialMonth(prevKey);
      const snap = await window.get(prevRef);
      if (!snap.exists()) {
        console.log(`cleanupHistorialByPolicy: no hay historial para eliminar (${prevKey})`);
        return;
      }
      await window.remove(prevRef);
      console.log(`cleanupHistorialByPolicy: historial del mes anterior eliminado -> ${prevKey}`);
    } catch (err) {
      console.error("cleanupHistorialByPolicy error:", err);
    }
  }

  // Reseteo contador diario: asegura que /counters/{ISODate}.lastId exista y, si no, lo crea en 0
  async function ensureDailyCounter() {
    try {
      const now = hoyObj();
      const cRef = dbPaths.countersForDate(now.isoDate);
      const snap = await window.get(cRef);
      if (!snap.exists()) {
        await window.set(cRef, { lastId: 0 });
        console.log(`ensureDailyCounter: creado contador para ${now.isoDate} con lastId=0`);
      } else {
        // opcional: si existe pero no tiene lastId, inicializar
        const val = snap.val();
        if (val == null || typeof val.lastId === "undefined") {
          await window.update(cRef, { lastId: 0 });
          console.log(`ensureDailyCounter: inicializado lastId=0 en ${now.isoDate}`);
        } else {
          console.log(`ensureDailyCounter: contador existente para ${now.isoDate} -> lastId=${val.lastId}`);
        }
      }
    } catch (err) {
      console.error("ensureDailyCounter error:", err);
    }
  }

  // Programador: ejecutar una función a las 00:05 (hora local) y luego cada 24h
  function scheduleAtFiveAfterMidnight(fn) {
    try {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0, 0);
      const ms = next - now;
      setTimeout(async function runAndSchedule() {
        try { await fn(); } catch (e) { console.error("Scheduled fn error:", e); }
        // programar repetición diaria
        setInterval(async () => {
          try { await fn(); } catch (e) { console.error("Scheduled fn error:", e); }
        }, 24 * 60 * 60 * 1000);
      }, Math.max(0, ms));
      console.log("scheduleAtFiveAfterMidnight: programado para " + next.toString());
    } catch (err) {
      console.warn("scheduleAtFiveAfterMidnight error:", err);
    }
  }

  // Ejecutar ahora (al cargar) y programar para medianoche+5
  try {
    await cleanupHistorialByPolicy();
    await ensureDailyCounter();
    scheduleAtFiveAfterMidnight(async () => {
      await cleanupHistorialByPolicy();
      await ensureDailyCounter();
    });
  } catch (e) {
    console.error("Auto-maintenance init error:", e);
  }

  // Export pequeño: función util para reiniciar manualmente (útil para debugging)
  window.__supercode_maintenance = {
    runCleanup: cleanupHistorialByPolicy,
    ensureCounter: ensureDailyCounter
  };
})();
