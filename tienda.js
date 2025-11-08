// --- Firebase Modular 11.8.1 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAL_STIsIDz6siydm10x1WtJ0hkgEgVaQM",
  authDomain: "zonapc-actualizado.firebaseapp.com",
  databaseURL: "https://zonapc-actualizado-default-rtdb.firebaseio.com",
  projectId: "zonapc-actualizado",
  storageBucket: "zonapc-actualizado.appspot.com",
  messagingSenderId: "20178926511",
  appId: "1:20178926511:web:8a235ed2fa2b5e6efb8c5f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const rutaFotos = "productos/";
const imgDefecto = "img/item.png";

// --- VARIABLES ---
let productos = [];
let categorias = [];
let carrito = JSON.parse(localStorage.getItem("carritoZonaPC") || "[]");
let cupones = [];
let cuponAplicado = null;
let numeroWhatsApp = "+540123456789"; // valor por defecto

// --- INICIALIZAR ---
document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfigTienda(); // nombre + ubicación + whatsapp
  await cargarCategorias();
  await cargarCupones();
  await cargarProductos();
  actualizarCarritoUI();

  document.getElementById("filtro-categoria").addEventListener("change", renderProductos);
  document.getElementById("busqueda").addEventListener("input", renderProductos);
  document.getElementById("abrir-carrito").addEventListener("click", toggleCarrito);
  document.getElementById("cerrar-carrito").addEventListener("click", toggleCarrito);
  document.getElementById("vaciar-carrito").addEventListener("click", vaciarCarrito);
  document.getElementById("aplicar-cupon").addEventListener("click", aplicarCupon);
  document.getElementById("finalizar-compra").addEventListener("click", finalizarCompra);
});

// --- CARGAR CONFIG (NOMBRE, UBICACIÓN, WHATSAPP) ---
async function cargarConfigTienda() {
  try {
    const snap = await get(ref(db, "/config"));
    const header = document.getElementById("nombre-tienda");

    if (snap.exists()) {
      const val = snap.val();
      const nombre = val.shopName || "Tienda";
      const ubicacion = val.shopLocation || "Sucursal Nueva";
      const numero = val.whatsapp ? val.whatsapp.toString().trim() : "0123456789";

      numeroWhatsApp = `+54${numero}`;
      header.textContent = `${nombre} (${ubicacion}) — ${numero}`;
    } else {
      numeroWhatsApp = "+540123456789";
      header.textContent = "Tienda (Sucursal Nueva) — 0123456789";
    }

    // Acción del botón flotante
    const btnWA = document.getElementById("whatsapp-float");
    if (btnWA) {
      btnWA.onclick = () => {
        const mensaje = "Hola, quiero hacer un pedido, vengo de la tienda";
        const url = `https://wa.me/${numeroWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, "_blank");
      };
    }

  } catch (err) {
    console.warn("No se pudo cargar configuración:", err);
    numeroWhatsApp = "+540123456789";
    document.getElementById("nombre-tienda").textContent = "Tienda (Sucursal Nueva) — 0123456789";
  }
}

// --- CARGAR CATEGORÍAS ---
async function cargarCategorias() {
  const snap = await get(ref(db, "/categorias"));
  categorias = snap.exists() ? snap.val() : ["Sin categoría", "Promos"];
  const sel = document.getElementById("filtro-categoria");
  sel.innerHTML = `<option value="">Todas las categorías</option>`;
  categorias.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// --- CARGAR CUPONES ---
async function cargarCupones() {
  const snap = await get(ref(db, "/cupones"));
  if (!snap.exists()) return;
  cupones = Object.values(snap.val());
}

// --- CARGAR PRODUCTOS ---
async function cargarProductos() {
  const cont = document.getElementById("lista-productos");
  cont.innerHTML = "<p>Cargando productos...</p>";

  try {
    const [snapStock, snapSueltos] = await Promise.all([
      get(ref(db, "/stock")),
      get(ref(db, "/sueltos"))
    ]);

    productos = [];
    const agregar = (snap, tipo) => {
      if (!snap.exists()) return;
      Object.entries(snap.val()).forEach(([codigo, d]) => {
        const precioNum = parseFloat(d.precio);
        productos.push({
          codigo,
          nombre: d.nombre || "Sin nombre",
          precio: isNaN(precioNum) ? 0 : precioNum,
          categoria: d.categoria || "Sin categoría",
          tipo
        });
      });
    };

    agregar(snapStock, "STOCK");
    agregar(snapSueltos, "SUELTO");
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    if (!productos.length) {
      cont.innerHTML = "<p>No hay productos disponibles.</p>";
      return;
    }

    await renderProductos();
  } catch (err) {
    console.error("Error al cargar productos:", err);
    cont.innerHTML = "<p>Error al cargar productos.</p>";
  }
}

// --- RENDER PRODUCTOS ---
async function renderProductos() {
  const cont = document.getElementById("lista-productos");
  cont.innerHTML = "";
  const filtro = document.getElementById("filtro-categoria").value;
  const texto = document.getElementById("busqueda").value.toLowerCase();

  const filtrados = productos.filter(p => {
    return (!filtro || p.categoria === filtro) &&
           (!texto || p.nombre.toLowerCase().includes(texto) || p.codigo.toLowerCase().includes(texto));
  });

  if (!filtrados.length) {
    cont.innerHTML = "<p>No hay productos que coincidan con el filtro.</p>";
    return;
  }

  for (const p of filtrados) {
    const card = document.createElement("div");
    card.className = "producto";

    const img = document.createElement("img");
    img.src = imgDefecto;
    img.alt = p.nombre;

    try {
      const url = await getDownloadURL(storageRef(storage, `${rutaFotos}${p.codigo}.webp`));
      img.src = url;
    } catch {
      try {
        const url2 = await getDownloadURL(storageRef(storage, `${rutaFotos}${p.codigo}.jpg`));
        img.src = url2;
      } catch {
        img.src = imgDefecto;
      }
    }

    const nombre = document.createElement("h3");
    nombre.textContent = p.nombre;

    const precio = document.createElement("p");
    precio.textContent = `$${p.precio.toFixed(2)}`;

    const btn = document.createElement("button");
    btn.textContent = "Agregar";
    btn.onclick = () => agregarAlCarrito(p);

    card.append(img, nombre, precio, btn);
    cont.appendChild(card);
  }
}

// --- CARRITO ---
function agregarAlCarrito(prod) {
  const item = carrito.find(i => i.codigo === prod.codigo);
  if (item) item.cantidad++;
  else carrito.push({ ...prod, cantidad: 1 });
  guardarCarrito();
  actualizarCarritoUI();
}

function guardarCarrito() {
  localStorage.setItem("carritoZonaPC", JSON.stringify(carrito));
}

function actualizarCarritoUI() {
  document.getElementById("carrito-cantidad").textContent = carrito.reduce((a, b) => a + b.cantidad, 0);
  const lista = document.getElementById("carrito-lista");
  lista.innerHTML = "";

  carrito.forEach(item => {
    const div = document.createElement("div");
    div.className = "carrito-item";
    div.innerHTML = `
      <span>${item.nombre}</span>
      <span>$${item.precio.toFixed(2)}</span>
      <div>
        <button class="menos">−</button>
        <span>${item.cantidad}</span>
        <button class="mas">+</button>
      </div>
    `;

    div.querySelector(".menos").onclick = () => {
      if (item.cantidad > 1) item.cantidad--;
      else carrito = carrito.filter(i => i.codigo !== item.codigo);
      guardarCarrito();
      actualizarCarritoUI();
    };

    div.querySelector(".mas").onclick = () => {
      item.cantidad++;
      guardarCarrito();
      actualizarCarritoUI();
    };

    lista.appendChild(div);
  });

  actualizarTotales();
}

function vaciarCarrito() {
  if (confirm("¿Vaciar carrito?")) {
    carrito = [];
    cuponAplicado = null;
    guardarCarrito();
    actualizarCarritoUI();
  }
}

function toggleCarrito() {
  document.getElementById("carrito-panel").classList.toggle("oculto");
}

// --- CUPONES ---
function aplicarCupon() {
  const codigo = document.getElementById("cupon-codigo").value.trim().toUpperCase();
  if (!codigo) return alert("Ingrese un código de cupón.");
  const hoy = new Date().toISOString().split("T")[0];

  const cup = cupones.find(c =>
    c.codigo.toUpperCase() === codigo &&
    (!c.fechaInicio || c.fechaInicio <= hoy) &&
    (!c.fechaFin || c.fechaFin >= hoy)
  );

  if (!cup) {
    alert("❌ Cupón no válido o vencido.");
    cuponAplicado = null;
  } else {
    cuponAplicado = cup;
    alert(`✅ Cupón ${codigo} aplicado (${cup.descuento}% de descuento).`);
  }

  actualizarTotales();
}

function actualizarTotales() {
  const subtotal = carrito.reduce((a, b) => a + b.precio * b.cantidad, 0);
  let descuento = 0;

  if (cuponAplicado) {
    if (!cuponAplicado.categoria || cuponAplicado.categoria === "Cualquier categoría") {
      descuento = cuponAplicado.descuento;
    } else {
      const tieneCat = carrito.some(p => p.categoria === cuponAplicado.categoria);
      if (tieneCat) descuento = cuponAplicado.descuento;
    }
  }

  const total = subtotal * (1 - descuento / 100);

  document.getElementById("subtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("descuento").textContent = `${descuento}%`;
  document.getElementById("total").textContent = `$${total.toFixed(2)}`;
}

// --- FINALIZAR COMPRA ---
function finalizarCompra() {
  if (!carrito.length) return alert("Tu carrito está vacío.");

  const metodo = document.getElementById("metodo-pago").value;
  const subtotal = carrito.reduce((a, b) => a + b.precio * b.cantidad, 0);
  const desc = document.getElementById("descuento").textContent;
  const total = document.getElementById("total").textContent;
  const cup = cuponAplicado ? cuponAplicado.codigo : "Ninguno";

  let mensaje = `🛍️ *Nuevo Pedido desde la Tienda*\n\n`;
  mensaje += `*Método de pago:* ${metodo}\n`;
  mensaje += `*Cupón:* ${cup}\n\n`;
  mensaje += `*Productos:*\n`;

  carrito.forEach(item => {
    const subtotalItem = item.precio * item.cantidad;
    mensaje += `• ${item.nombre} (${item.codigo})\n  Cantidad: ${item.cantidad} — $${subtotalItem.toFixed(2)}\n`;
  });

  mensaje += `\n*Subtotal:* ${document.getElementById("subtotal").textContent}`;
  mensaje += `\n*Descuento:* ${desc}`;
  mensaje += `\n*Total final:* ${total}`;
  mensaje += `\n\n✅ *Pedido listo para procesar.*`;

  const url = `https://wa.me/${numeroWhatsApp.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}
