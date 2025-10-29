/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database y Firestore
 * Compatible Firebase 11.8.1 modular
 *****************************************************/
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

(() => {
  const ramasIniciales = {
    config: { shopName: "ZONAPC", passAdmin: "1918", masterPass: "1409" },
    cajeros: {},
    stock: {},
    sueltos: {},
    movimientos: {},
    historial: {}
  };

  (async () => {
    try {
      const rootRef = window.ref("/"); // wrapper global del index.html
      const rootSnap = await window.get(rootRef);
      if (!rootSnap.exists() || rootSnap.val() === null) {
        await window.set(rootRef, ramasIniciales);
        console.log("✅ Base inicializada en Realtime Database");
      } else {
        console.log("ℹ️ Base ya existente, no se sobrescribió");
      }

      // --- FIRESTORE: Verificar categoría inicial "PROMOS" ---
      const dbFS = getFirestore();
      const docRef = doc(dbFS, "categorias", "TODO");
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { nombre: "TODO", fechaCreacion: Date.now() });
        console.log("✅ Categoría inicial TODO creada en Firestore");
      } else {
        console.log("ℹ️ Categoría TODO ya existente en Firestore");
      }
    } catch (err) {
      console.error("❌ Error al inicializar bases:", err);
    }
  })();
})();

// --- Inicialización global del sistema ---
window.addEventListener("DOMContentLoaded", async () => {
  try {
    if (typeof loadStock === "function")      loadStock();
    if (typeof loadSueltos === "function")    loadSueltos();
    if (typeof loadCajeros === "function")    loadCajeros();
    if (typeof loadMovimientos === "function")loadMovimientos();
    if (typeof loadHistorial === "function")  loadHistorial();
    if (typeof loadTienda === "function")     loadTienda(); // Nueva sección
  } catch (err) {
    console.error("Error en inicialización global:", err);
  }
});
