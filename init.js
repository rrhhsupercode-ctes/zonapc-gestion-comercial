/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database y Firestore
 * Compatible Firebase 11.8.1 modular
 *****************************************************/
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

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
      // --- Realtime Database ---
      const rootRef = window.ref("/");
      const rootSnap = await window.get(rootRef);
      if (!rootSnap.exists() || rootSnap.val() === null) {
        await window.set(rootRef, ramasIniciales);
        console.log("✅ Base inicializada en Realtime Database");
      } else {
        console.log("ℹ️ Base ya existente, no se sobrescribió");
      }

      // --- Corrige automáticamente el bucket incorrecto ---
      if (window.app?.options?.storageBucket?.includes("firebasestorage.app")) {
        window.app.options.storageBucket = `${window.app.options.projectId}.appspot.com`;
        console.log("⚙️ Bucket corregido automáticamente:", window.app.options.storageBucket);
      }

      // --- Autenticación anónima (previene errores de permisos) ---
      const auth = getAuth(window.app);
      try {
        await signInAnonymously(auth);
        console.log("✅ Sesión anónima iniciada para Firestore");
      } catch (e) {
        console.warn("⚠️ No se pudo autenticar anónimamente:", e.message);
      }

      // --- Firestore: verificar categoría inicial "TODO" ---
      const dbFS = getFirestore(window.app);

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
    if (typeof loadTienda === "function")     loadTienda();
    if (typeof loadGastos === "function")     loadGastos();
  } catch (err) {
    console.error("Error en inicialización global:", err);
  }
});
