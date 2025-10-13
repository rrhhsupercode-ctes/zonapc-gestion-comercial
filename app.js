// ---------------------------
// APP.JS - BASE COMPLETA
// ---------------------------

// ---------------------------
// 1. VARIABLES GLOBALES
// ---------------------------
const secciones = {
  cobro: document.getElementById("cobro"),
  movimientos: document.getElementById("movimientos"),
  historial: document.getElementById("historial"),
  stock: document.getElementById("stock"),
  sueltos: document.getElementById("sueltos"),
  cajeros: document.getElementById("cajeros"),
  config: document.getElementById("config")
};

const navBtns = document.querySelectorAll(".nav-btn");

// Modales
let modalActivo = null;

// Mensajes
function mostrarMensaje(elem, texto, tipo="error"){
  elem.textContent = texto;
  elem.className = tipo === "error" ? "msg-error" :
                   tipo === "exito" ? "msg-exito" : "msg-alerta";
}

// ---------------------------
// 2. FUNCIONES UTILES
// ---------------------------

// Mostrar sección y ocultar las demás
function mostrarSeccion(nombre){
  Object.values(secciones).forEach(s => s.classList.add("hidden"));
  if(secciones[nombre]) secciones[nombre].classList.remove("hidden");
}

// Mostrar modal
function mostrarModal(modal){
  modal.classList.remove("hidden");
  modalActivo = modal;
  document.body.style.filter = "blur(4px)";
}

// Cerrar modal
function cerrarModal(modal){
  if(modal) modal.classList.add("hidden");
  modalActivo = null;
  document.body.style.filter = "none";
}

// ---------------------------
// 3. NAVEGACION ENTRE SECCIONES
// ---------------------------
navBtns.forEach(btn => {
  btn.addEventListener("click", ()=>{
    const seccion = btn.dataset.section;
    mostrarSeccion(seccion);
  });
});

// Mostrar sección por defecto
mostrarSeccion("cobro");

// ---------------------------
// 4. LOGIN ADMINISTRADOR
// ---------------------------
const loginModal = document.getElementById("login-modal");
const loginPass = document.getElementById("login-pass");
const btnLogin = document.getElementById("btn-login");
const loginMsg = document.getElementById("login-msg");

async function validarAdmin(pass){
  const configSnap = await window.get(window.ref("config"));
  if(!configSnap.exists()) return false;

  const config = configSnap.val();
  return pass === config.passAdmin || pass === config.masterPass;
}

// Evento login
btnLogin.addEventListener("click", async ()=>{
  const pass = loginPass.value.trim();
  if(await validarAdmin(pass)){
    cerrarModal(loginModal);
  } else {
    mostrarMensaje(loginMsg, "Contraseña incorrecta", "error");
  }
});

// ---------------------------
// 5. LOGIN CAJERO
// ---------------------------
const loginUsuario = document.getElementById("login-usuario");
const loginCajeroPass = document.getElementById("login-pass");
const btnCajeroLogin = document.getElementById("btn-login");
const loginCajeroMsg = document.getElementById("login-msg");

// Cargar select de cajeros
async function cargarCajerosSelect(){
  loginUsuario.innerHTML = "";
  const cajerosSnap = await window.get(window.ref("cajeros"));
  if(!cajerosSnap.exists()) return;

  const cajeros = cajerosSnap.val();
  Object.keys(cajeros).forEach(nro=>{
    const option = document.createElement("option");
    option.value = nro;
    option.textContent = nro;
    loginUsuario.appendChild(option);
  });
}

// Inicializar
cargarCajerosSelect();

// ---------------------------
// 6. UTILIDADES FIREBASE
// ---------------------------
async function registrarMovimiento(mov){
  const fechaHoy = new Date().toISOString().slice(0,10);
  const movRef = window.ref(`movimientos/${fechaHoy}`);
  const movPush = window.push(movRef);
  await window.set(movPush, mov);
  return movPush.key;
}

// ---------------------------
// 7. CONTROLES DE COBRO
// ---------------------------
const cobroControles = document.getElementById("cobro-controles");
const cobroCantidad = document.getElementById("cobro-cantidad");
const cobroCodigo = document.getElementById("cobro-codigo");
const cobroProductos = document.getElementById("cobro-productos");
const btnAddProduct = document.getElementById("btn-add-product");

const inputKgSuelto = document.getElementById("input-kg-suelto");
const cobroCodigoSuelto = document.getElementById("cobro-codigo-suelto");
const cobroSueltos = document.getElementById("cobro-sueltos");
const btnAddSuelto = document.getElementById("btn-add-suelto");
const btnIncrKg = document.getElementById("btn-incr-kg");
const btnDecrKg = document.getElementById("btn-decr-kg");

const tablaCobro = document.querySelector("#tabla-cobro tbody");
const totalDiv = document.getElementById("total-div");
const btnCobrar = document.getElementById("btn-cobrar");

// Variables de sesión de cajero
let cajeroActivo = null;
let productosCobro = [];

// ---------------------------
// 8. FUNCIONES COBRO
// ---------------------------
function actualizarTabla(){
  tablaCobro.innerHTML = "";
  let total = 0;
  productosCobro.forEach((p,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.cantKG}</td>
      <td>${p.nombre}</td>
      <td>$${p.precio}</td>
      <td>$${p.total.toFixed(2)}</td>
      <td><button class="btn-eliminar" data-index="${i}">Eliminar</button></td>
    `;
    tablaCobro.appendChild(tr);
    total += p.total;
  });
  totalDiv.textContent = `TOTAL: $${total.toFixed(2)}`;
}

// ---------------------------
// 9. CONTROL KG SUELTOS
// ---------------------------
btnIncrKg.addEventListener("click", ()=>{
  let val = parseFloat(inputKgSuelto.value);
  if(val+0.1 <= 99.9) val+=0.1;
  inputKgSuelto.value = val.toFixed(3);
});

btnDecrKg.addEventListener("click", ()=>{
  let val = parseFloat(inputKgSuelto.value);
  if(val-0.1 >= 0.1) val-=0.1;
  inputKgSuelto.value = val.toFixed(3);
});

// ---------------------------
// 10. AGREGAR PRODUCTO STOCK/SUELTOS
// ---------------------------
btnAddProduct.addEventListener("click", ()=>{
  const nombre = cobroProductos.value;
  const cant = parseInt(cobroCantidad.value);
  const precio = parseFloat(cobroProductos.selectedOptions[0]?.dataset.precio || 0);
  if(!nombre || cant<=0) return;
  productosCobro.push({nombre, cantKG:cant, precio, total: cant*precio});
  actualizarTabla();
});

btnAddSuelto.addEventListener("click", ()=>{
  const nombre = cobroSueltos.value;
  const kg = parseFloat(inputKgSuelto.value);
  const precio = parseFloat(cobroSueltos.selectedOptions[0]?.dataset.precio || 0);
  if(!nombre || kg<=0) return;
  productosCobro.push({nombre, cantKG:kg, precio, total: kg*precio});
  actualizarTabla();
});

// ---------------------------
// 11. BOTON COBRAR (AUN SIN MODAL TIPO DE PAGO)
// ---------------------------
btnCobrar.addEventListener("click", async ()=>{
  if(!cajeroActivo) return alert("Debe iniciar sesión como cajero");
  const fecha = new Date().toISOString();
  const total = productosCobro.reduce((a,b)=>a+b.total,0);
  const mov = {
    cajero: cajeroActivo,
    fecha,
    total,
    productos: productosCobro,
    tipoPago: null
  };
  await registrarMovimiento(mov);
  productosCobro = [];
  actualizarTabla();
  alert("Venta registrada correctamente en Firebase");
});

// ---------------------------
// 12. MODAL TIPO DE PAGO
// ---------------------------
function crearModalPago(){
  // Crear overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  // Crear modal
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>¿Cómo Pagará el Cliente?</h3>
    <div>
      <button data-pago="Efectivo">Efectivo</button>
      <button data-pago="Tarjeta">Tarjeta</button>
      <button data-pago="QR">QR</button>
      <button data-pago="Electrónico">Electrónico</button>
      <button data-pago="Otro">Otro</button>
    </div>
    <button id="cancelar-pago" style="background:#d63031; color:#fff;">Cancelar</button>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Evento botones pago
  modal.querySelectorAll("button[data-pago]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const tipoPago = btn.dataset.pago;
      await finalizarCobro(tipoPago);
      cerrarModal(overlay);
    });
  });

  // Cancelar
  modal.querySelector("#cancelar-pago").addEventListener("click", ()=>{
    cerrarModal(overlay);
  });

  return overlay;
}

let modalPago = crearModalPago();
modalPago.classList.add("hidden");

// ---------------------------
// 13. FINALIZAR COBRO
// ---------------------------
async function finalizarCobro(tipoPago){
  if(!cajeroActivo || productosCobro.length===0) return;

  const fecha = new Date();
  const fechaStr = fecha.toISOString();
  const total = productosCobro.reduce((a,b)=>a+b.total,0);

  const movimiento = {
    id: null, // Se generará ID
    fecha: fechaStr,
    cajero: cajeroActivo,
    productos: productosCobro,
    total,
    tipoPago
  };

  // Registrar movimiento en Firebase
  const idMov = await registrarMovimiento(movimiento);
  movimiento.id = idMov;

  // Actualizar stock y sueltos
  for(let p of productosCobro){
    if(p.tipo==="STOCK"){
      const stockRef = window.ref(`stock/${p.codigo}`);
      const snap = await window.get(stockRef);
      if(snap.exists()){
        const stockData = snap.val();
        await window.update(stockRef, {cant: stockData.cant - p.cantKG});
      }
    } else if(p.tipo==="SUELTOS"){
      const sueltosRef = window.ref(`sueltos/${p.codigo}`);
      const snap = await window.get(sueltosRef);
      if(snap.exists()){
        const sueltoData = snap.val();
        await window.update(sueltosRef, {kg: sueltoData.kg - p.cantKG});
      }
    }
  }

  productosCobro = [];
  actualizarTabla();
  alert(`Venta realizada con éxito. Tipo de pago: ${tipoPago}`);
}

// ---------------------------
// 14. MODAL COBRAR - EVENTO
// ---------------------------
btnCobrar.addEventListener("click", ()=>{
  if(!cajeroActivo || productosCobro.length===0) return;
  mostrarModal(modalPago);
});

// ---------------------------
// 15. ASIGNAR TIPOS A PRODUCTOS
// ---------------------------
btnAddProduct.addEventListener("click", ()=>{
  const nombre = cobroProductos.value;
  const cant = parseInt(cobroCantidad.value);
  const precio = parseFloat(cobroProductos.selectedOptions[0]?.dataset.precio || 0);
  if(!nombre || cant<=0) return;

  productosCobro.push({
    nombre,
    cantKG: cant,
    precio,
    total: cant*precio,
    tipo: "STOCK",
    codigo: cobroProductos.selectedOptions[0]?.value
  });

  actualizarTabla();
});

btnAddSuelto.addEventListener("click", ()=>{
  const nombre = cobroSueltos.value;
  const kg = parseFloat(inputKgSuelto.value);
  const precio = parseFloat(cobroSueltos.selectedOptions[0]?.dataset.precio || 0);
  if(!nombre || kg<=0) return;

  productosCobro.push({
    nombre,
    cantKG: kg,
    precio,
    total: kg*precio,
    tipo: "SUELTOS",
    codigo: cobroSueltos.selectedOptions[0]?.value
  });

  actualizarTabla();
});

// ---------------------------
// 16. IMPRESIÓN DE TICKETS
// ---------------------------
function imprimirTicket(movimiento){
  const printArea = document.createElement("div");
  printArea.className = "print-area";
  let html = `<div id="texto-ticket">`;
  html += `ID_${movimiento.id}<br>`;
  html += `${formatoFecha(movimiento.fecha)}<br>`;
  html += `Cajero: ${movimiento.cajero}<br>`;
  html += `==========<br>`;
  movimiento.productos.forEach(p=>{
    html += `${p.nombre} $${p.precio.toFixed(2)} (${p.cantKG}${p.tipo==="STOCK"?"x"+p.cantKG:""}) = $${p.total.toFixed(2)}<br>`;
    html += `==========<br>`;
  });
  html += `TOTAL: $${movimiento.total.toFixed(2)}<br>`;
  html += `Pago: ${movimiento.tipoPago}<br>`;
  html += `</div><hr id="hr-ticket">`;
  printArea.innerHTML = html;
  document.body.appendChild(printArea);
  window.print();
  document.body.removeChild(printArea);
}

function formatoFecha(fechaISO){
  const d = new Date(fechaISO);
  const dia = String(d.getDate()).padStart(2,'0');
  const mes = String(d.getMonth()+1).padStart(2,'0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');
  return `${dia}/${mes}/${anio} (${hora}:${min})`;
}

// ---------------------------
// 17. REGISTRAR MOVIMIENTO EN FIREBASE
// ---------------------------
async function registrarMovimiento(mov){
  const refMov = window.ref("movimientos");
  const snap = await window.get(refMov);
  let idNuevo = 1;
  if(snap.exists()){
    const keys = Object.keys(snap.val());
    if(keys.length>0){
      const idsNum = keys.map(k=>parseInt(k.split("_")[1],10));
      idNuevo = Math.max(...idsNum)+1;
    }
  }
  const idStr = String(idNuevo).padStart(6,'0');
  await window.set(window.ref(`movimientos/ID_${idStr}`), mov);
  return idStr;
}

// ---------------------------
// 18. CARGAR MOVIMIENTOS EN TABLA
// ---------------------------
async function cargarMovimientos(){
  const tabla = document.querySelector("#tabla-movimientos tbody");
  tabla.innerHTML = "";
  const snap = await window.get(window.ref("movimientos"));
  if(!snap.exists()) return;

  const movs = Object.entries(snap.val())
    .sort((a,b)=>new Date(b[1].fecha)-new Date(a[1].fecha));

  for(const [id, mov] of movs){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${id}</td>
      <td>$${mov.total.toFixed(2)}</td>
      <td>${mov.tipoPago}</td>
      <td>
        <button class="btn-ver">Reimprimir</button>
        <button class="btn-eliminar">Eliminar</button>
      </td>
    `;
    // Reimprimir
    tr.querySelector(".btn-ver").addEventListener("click", ()=>imprimirTicket(mov));
    // Eliminar
    tr.querySelector(".btn-eliminar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          await window.remove(window.ref(`movimientos/${id}`));
          // Restaurar stock/sueltos
          for(let p of mov.productos){
            if(p.tipo==="STOCK"){
              const sRef = window.ref(`stock/${p.codigo}`);
              const snap = await window.get(sRef);
              if(snap.exists()){
                await window.update(sRef, {cant: snap.val().cant + p.cantKG});
              }
            } else if(p.tipo==="SUELTOS"){
              const sRef = window.ref(`sueltos/${p.codigo}`);
              const snap = await window.get(sRef);
              if(snap.exists()){
                await window.update(sRef, {kg: snap.val().kg + p.cantKG});
              }
            }
          }
          cargarMovimientos();
        }
      });
    });

    tabla.appendChild(tr);
  }
}

// ---------------------------
// 19. MODAL CONTRASEÑA ADMIN
// ---------------------------
function modalPassword(callback){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>Contraseña Administrador</h3>
    <input type="password" id="pass-admin-modal" placeholder="Contraseña">
    <div>
      <button id="aceptar-pass">Aceptar</button>
      <button id="cancelar-pass">Cancelar</button>
    </div>
    <p id="pass-msg" class="msg-error"></p>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector("#aceptar-pass").addEventListener("click", async ()=>{
    const val = modal.querySelector("#pass-admin-modal").value;
    const snap = await window.get(window.ref("config/passAdmin"));
    if(val===snap.val()){
      cerrarModal(overlay);
      callback(true);
    } else {
      modal.querySelector("#pass-msg").innerText="Contraseña incorrecta";
      callback(false);
    }
  });
  modal.querySelector("#cancelar-pass").addEventListener("click", ()=>{
    cerrarModal(overlay);
    callback(false);
  });
}

// ---------------------------
// 20. CARGAR HISTORIAL (POR DÍAS)
// ---------------------------
async function cargarHistorial(dia = new Date()){
  const tabla = document.querySelector("#tabla-historial tbody");
  tabla.innerHTML = "";
  const snap = await window.get(window.ref("historial"));
  if(!snap.exists()) return;

  const movs = Object.entries(snap.val())
    .filter(([id, mov])=>{
      const fechaMov = new Date(mov.fecha);
      return fechaMov.toDateString()===dia.toDateString();
    })
    .sort((a,b)=>new Date(b[1].fecha)-new Date(a[1].fecha));

  for(const [id, mov] of movs){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${id}</td>
      <td>$${mov.total.toFixed(2)}</td>
      <td>${mov.tipoPago}</td>
      <td>${mov.cajero}</td>
      <td>${formatoFecha(mov.fecha)}</td>
      <td>
        <button class="btn-ver">Reimprimir</button>
      </td>
    `;
    tr.querySelector(".btn-ver").addEventListener("click", ()=>imprimirTicket(mov));
    tabla.appendChild(tr);
  }
}

// ---------------------------
// 21. INICIALIZACIÓN MOV/HIST
// ---------------------------
document.addEventListener("DOMContentLoaded", ()=>{
  cargarMovimientos();
  cargarHistorial();
});

// ---------------------------
// 22. CARGAR STOCK
// ---------------------------
async function cargarStock(){
  const tabla = document.querySelector("#tabla-stock tbody");
  tabla.innerHTML = "";
  const snap = await window.get(window.ref("stock"));
  if(!snap.exists()) return;

  const items = Object.entries(snap.val())
    .sort((a,b)=>new Date(b[1].fecha)-new Date(a[1].fecha));

  for(const [codigo, item] of items){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.cant}</td>
      <td>${formatoFecha(item.fecha)}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="btn-guardar">Editar</button>
        <button class="btn-eliminar">Eliminar</button>
      </td>
    `;
    // Editar
    tr.querySelector(".btn-guardar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          const nuevoNombre = prompt("Nombre:", item.nombre) || item.nombre;
          const nuevaCant = parseFloat(prompt("Cantidad:", item.cant)) || item.cant;
          const nuevoPrecio = parseFloat(prompt("Precio:", item.precio)) || item.precio;
          await window.update(window.ref(`stock/${codigo}`), {nombre:nuevoNombre, cant:nuevaCant, precio:nuevoPrecio});
          cargarStock();
        }
      });
    });
    // Eliminar
    tr.querySelector(".btn-eliminar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          await window.remove(window.ref(`stock/${codigo}`));
          cargarStock();
        }
      });
    });

    tabla.appendChild(tr);
  }
}

// ---------------------------
// 23. AGREGAR STOCK
// ---------------------------
document.querySelector("#agregar-stock").addEventListener("click", async ()=>{
  modalPassword(async (ok)=>{
    if(!ok) return;
    const codigo = document.querySelector("#stock-codigo").value.padStart(3,'0');
    const cantidad = parseInt(document.querySelector("#stock-cantidad").value) || 1;
    const refItem = window.ref(`stock/${codigo}`);
    const snap = await window.get(refItem);
    if(snap.exists()){
      await window.update(refItem, {cant: snap.val().cant + cantidad});
    } else {
      await window.set(refItem, {nombre:"PRODUCTO NUEVO", cant:cantidad, precio:0, fecha:new Date().toISOString()});
    }
    cargarStock();
  });
});

// ---------------------------
// 24. SUELTOS
// ---------------------------
async function cargarSueltos(){
  const tabla = document.querySelector("#tabla-sueltos tbody");
  tabla.innerHTML = "";
  const snap = await window.get(window.ref("sueltos"));
  if(!snap.exists()) return;

  const items = Object.entries(snap.val())
    .sort((a,b)=>new Date(b[1].fecha)-new Date(a[1].fecha));

  for(const [codigo, item] of items){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${codigo}</td>
      <td>${item.nombre}</td>
      <td>${item.kg.toFixed(3)}</td>
      <td>${formatoFecha(item.fecha)}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>
        <button class="btn-guardar">Editar</button>
        <button class="btn-eliminar">Eliminar</button>
      </td>
    `;
    tr.querySelector(".btn-guardar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          const nuevoNombre = prompt("Nombre:", item.nombre) || item.nombre;
          const nuevaKG = parseFloat(prompt("KG:", item.kg)) || item.kg;
          const nuevoPrecio = parseFloat(prompt("Precio:", item.precio)) || item.precio;
          await window.update(window.ref(`sueltos/${codigo}`), {nombre:nuevoNombre, kg:nuevaKG, precio:nuevoPrecio});
          cargarSueltos();
        }
      });
    });
    tr.querySelector(".btn-eliminar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          await window.remove(window.ref(`sueltos/${codigo}`));
          cargarSueltos();
        }
      });
    });

    tabla.appendChild(tr);
  }
}

// ---------------------------
// 25. AGREGAR SUELTO
// ---------------------------
document.querySelector("#btn-agregar-suelto").addEventListener("click", async ()=>{
  modalPassword(async (ok)=>{
    if(!ok) return;
    const codigo = document.querySelector("#sueltos-codigo").value.padStart(3,'0');
    const kg = parseFloat(document.querySelector("#sueltos-kg").value) || 0.1;
    const refItem = window.ref(`sueltos/${codigo}`);
    const snap = await window.get(refItem);
    if(snap.exists()){
      await window.update(refItem, {kg: snap.val().kg + kg});
    } else {
      await window.set(refItem, {nombre:"PRODUCTO NUEVO", kg, precio:0, fecha:new Date().toISOString()});
    }
    cargarSueltos();
  });
});

// ---------------------------
// 26. CAJEROS
// ---------------------------
async function cargarCajeros(){
  const tabla = document.querySelector("#tabla-cajeros tbody");
  tabla.innerHTML = "";
  const snap = await window.get(window.ref("cajeros"));
  if(!snap.exists()) return;

  const items = Object.entries(snap.val()).sort((a,b)=>a[0]-b[0]);
  for(const [nro, c] of items){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nro}</td>
      <td>${c.nombre}</td>
      <td>${c.dni}</td>
      <td>
        <button class="btn-guardar">Editar</button>
        <button class="btn-eliminar">Eliminar</button>
      </td>
    `;
    tr.querySelector(".btn-guardar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          const nombre = prompt("Nombre:", c.nombre) || c.nombre;
          const dni = prompt("DNI:", c.dni) || c.dni;
          const pass = prompt("Contraseña:", c.pass) || c.pass;
          await window.update(window.ref(`cajeros/${nro}`), {nombre, dni, pass});
          cargarCajeros();
        }
      });
    });
    tr.querySelector(".btn-eliminar").addEventListener("click", ()=>{
      modalPassword(async (ok)=>{
        if(ok){
          await window.remove(window.ref(`cajeros/${nro}`));
          cargarCajeros();
        }
      });
    });

    tabla.appendChild(tr);
  }
}

// ---------------------------
// 27. AGREGAR CAJERO
// ---------------------------
document.querySelector("#agregar-cajero").addEventListener("click", ()=>{
  modalPassword(async (ok)=>{
    if(!ok) return;
    const nro = document.querySelector("#cajero-nro").value.padStart(2,'0');
    const nombre = document.querySelector("#cajero-nombre").value;
    const dni = document.querySelector("#cajero-dni").value;
    const pass = document.querySelector("#cajero-pass").value;
    await window.set(window.ref(`cajeros/${nro}`), {nombre,dni,pass});
    cargarCajeros();
  });
});

// ---------------------------
// 28. CONFIGURACIÓN
// ---------------------------
document.querySelector("#guardar-config").addEventListener("click", async ()=>{
  const passActual = document.querySelector("#config-pass-actual").value;
  const passNueva = document.querySelector("#config-pass-nueva").value;
  const snap = await window.get(window.ref("config/passAdmin"));
  if(passActual !== snap.val()){
    document.querySelector("#config-msg").innerText="Contraseña actual incorrecta";
    return;
  }
  await window.update(window.ref("config"), {passAdmin: passNueva});
  document.querySelector("#config-msg").innerText="Contraseña actualizada";
});

document.querySelector("#btn-restaurar").addEventListener("click", async ()=>{
  const master = document.querySelector("#master-pass").value;
  const snap = await window.get(window.ref("config/masterPass"));
  if(master !== snap.val()){
    document.querySelector("#config-msg").innerText="Contraseña maestra incorrecta";
    return;
  }
  await window.update(window.ref("config"), {passAdmin: snap.val()});
  document.querySelector("#config-msg").innerText="Contraseña restaurada a valor por defecto";
});

// ---------------------------
// 29. INICIALIZACIÓN STOCK, SUELTOS, CAJEROS
// ---------------------------
document.addEventListener("DOMContentLoaded", ()=>{
  cargarStock();
  cargarSueltos();
  cargarCajeros();
});
