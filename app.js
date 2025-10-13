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
let adminPass = "1918";
let masterPass = "1409";
let currentCajero = null;
let ticketsDiarios = {};
let stockData = {};
let sueltosData = {};
let cajerosData = {};
let movimientosData = {};
let historialData = {};
let ticketCounter = 1;

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

const formatMoney = n => `$${Number(n).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
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

function cargarCajeroLogin(){
    loginSelect.innerHTML="";
    Object.keys(cajerosData).sort().forEach(nro=>{
        const opt = document.createElement("option");
        opt.value = nro;
        opt.textContent = nro;
        loginSelect.appendChild(opt);
    });
}

const cantSelect = document.getElementById("cobro-cantidad");
for(let i=1;i<=99;i++){
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = String(i).padStart(2,'0');
    cantSelect.appendChild(opt);
}

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

const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
let cobroItems = [];

function renderTablaCobro(){
    tablaCobro.innerHTML="";
    let totalGeneral=0;
    cobroItems.forEach((item,index)=>{
        const totalItem = item.tipo==="stock"?item.cantidad*item.precio:item.cantidad*item.precio*item.porcentaje;
        totalGeneral+=totalItem;
        const tr = document.createElement("tr");
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

/* ---------------------------
   AGREGAR/ELIMINAR ITEMS
--------------------------- */
document.getElementById("btn-add-product").addEventListener("click",()=>{
    const codigo = document.getElementById("cobro-codigo").value.trim() || cobroProductos.value;
    if(!codigo || !stockData[codigo]) return;
    const cantidad = parseInt(document.getElementById("cobro-cantidad").value,10);
    cobroItems.unshift({tipo:"stock",codigo,nombre:stockData[codigo].nombre,cantidad,precio:stockData[codigo].precio});
    renderTablaCobro();
});

const kgInput = document.getElementById("input-kg-suelto");
document.getElementById("btn-incr-kg").addEventListener("click",()=>{kgInput.value=(parseFloat(kgInput.value)+0.1).toFixed(3)});
document.getElementById("btn-decr-kg").addEventListener("click",()=>{kgInput.value=Math.max(0.100,parseFloat(kgInput.value)-0.1).toFixed(3)});

document.getElementById("btn-add-suelto").addEventListener("click",()=>{
    const codigo = document.getElementById("cobro-codigo-suelto").value.trim() || cobroSueltos.value;
    if(!codigo || !sueltosData[codigo]) return;
    const kg = parseFloat(kgInput.value);
    const porcentaje = kg;
    cobroItems.unshift({tipo:"sueltos",codigo,nombre:sueltosData[codigo].nombre,cantidad:kg,precio:sueltosData[codigo].precio,porcentaje});
    renderTablaCobro();
});

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

/* ---------------------------
   COBRAR / REALIZAR VENTA
--------------------------- */
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
    modal.querySelectorAll(".pay-btn").forEach(btn=>{
        btn.addEventListener("click",async ()=>{
            const total = cobroItems.reduce((acc,i)=>{
                return acc + (i.tipo==="stock"?i.cantidad*i.precio:i.cantidad*i.precio*i.porcentaje);
            },0);
            const movID = `T${Date.now()}`;
            await window.set(window.ref(`movimientos/${movID}`),{
                cajero: currentCajero,
                total,
                items:cobroItems,
                tipo:btn.innerText,
                fecha:fechaHora()
            });
            alert("Venta registrada!");
            cobroItems=[];
            renderTablaCobro();
            modal.remove();
        });
    });
    modal.querySelector("#cancel-pay").addEventListener("click",()=>modal.remove());
});

/* ---------------------------
   CARGAR / RENDER FIREBASE
--------------------------- */
async function cargarStock(){
    const snap = await window.get(window.ref("stock"));
    stockData = snap.exists()?snap.val():{};
    actualizarSelectProductos();
}
async function cargarSueltos(){
    const snap = await window.get(window.ref("sueltos"));
    sueltosData = snap.exists()?snap.val():{};
    actualizarSelectProductos();
}
async function cargarCajeros(){
    const snap = await window.get(window.ref("cajeros"));
    cajerosData = snap.exists()?snap.val():{};
    cargarCajeroLogin();
}

/* ---------------------------
   AGREGAR STOCK / SUELTOS / CAJEROS
--------------------------- */
document.getElementById("agregar-stock").addEventListener("click",async ()=>{
    const codigo = document.getElementById("stock-codigo").value.trim();
    const cantidad = parseInt(document.getElementById("stock-cantidad").value,10);
    if(!codigo) return;
    stockData[codigo] = {nombre:codigo, cantidad, fecha:fechaHora(), precio:100};
    await window.set(window.ref(`stock/${codigo}`), stockData[codigo]);
    actualizarSelectProductos();
});

document.getElementById("btn-agregar-suelto").addEventListener("click",async ()=>{
    const codigo = document.getElementById("sueltos-codigo").value.trim();
    const kg = parseFloat(document.getElementById("sueltos-kg").value);
    if(!codigo) return;
    sueltosData[codigo] = {nombre:codigo, kg, fecha:fechaHora(), precio:150};
    await window.set(window.ref(`sueltos/${codigo}`), sueltosData[codigo]);
    actualizarSelectProductos();
});

document.getElementById("agregar-cajero").addEventListener("click",async ()=>{
    const nro = document.getElementById("cajero-nro").value.trim();
    const nombre = document.getElementById("cajero-nombre").value.trim();
    const dni = document.getElementById("cajero-dni").value.trim();
    const pass = document.getElementById("cajero-pass").value.trim();
    if(!nro || !nombre) return;
    cajerosData[nro]={nombre,dni,pass};
    await window.set(window.ref(`cajeros/${nro}`), cajerosData[nro]);
    cargarCajeroLogin();
});
