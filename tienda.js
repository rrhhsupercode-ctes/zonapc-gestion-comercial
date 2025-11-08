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

// --- CARGAR TODO ---
document.addEventListener("DOMContentLoaded", async () => {
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
});

// --- CARGAR CATEGORÍAS ---
async function cargarCategorias() {
  const snap = await get(ref(db, "/categorias"));
  categorias = snap.exists() ? snap.val() : ["Sin categoría", "Promos"];
  const sel = document.getElementById("filtro-categoria");
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
  const data = snap.val();
  cupones = Object.values(data);
}

// --- CARGAR PRODUCTOS ---
async function cargarProductos() {
  const [snapStock, snapSueltos] = await Promise.all([
    get(ref(db, "/stock")),
    get(ref(db, "/sueltos"))
  ]);

  productos = [];
  const agregar = (snap, tipo) => {
    if (!snap.exists()) return;
    Object.entries(snap.val()).forEach(([codigo, d]) => {
      productos.push({
        codigo,
        nombre: d.nombre || "Sin nombre",
        precio: d.precio || 0,
        categoria: d.categoria || "Sin categoría",
        tipo
      });
    });
  };

  agregar(snapStock, "STOCK");
  agregar(snapSueltos, "SUELTO");
  renderProductos();
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
    cont.innerHTML = "<p>No hay productos para mostrar.</p>";
    return;
  }

  for (const p of filtrados) {
    const card = document.createElement("div");
    card.className = "producto";

    const img = document.createElement("img");
    img.src = imgDefecto;
    img.alt = p.nombre;
    const pathWebp = `${rutaFotos}${p.codigo}.webp`;
    const pathJpg = `${rutaFotos}${p.codigo}.jpg`;

    try {
      const url = await getDownloadURL(storageRef(storage, pathWebp));
      img.src = url;
    } catch {
      try {
        const url2 = await getDownloadURL(storageRef(storage, pathJpg));
        img.src = url2;
      } catch {}
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
