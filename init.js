/*****************************************************
 * init.js
 * Inicialización de la base en Realtime Database
 * Compatible Firebase 11.8.1 modular
 *****************************************************/
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
      const rootRef = window.ref("/"); // wrapper global definido en index.html
      const rootSnap = await window.get(rootRef);
      
      if (!rootSnap.exists() || rootSnap.val() === null) {
        await window.set(rootRef, ramasIniciales);
        console.log("✅ Base inicializada en Firebase");
      } else {
        console.log("ℹ️ Base ya existente, no se sobrescribió");
      }
    } catch (err) {
      console.error("❌ Error al inicializar la base:", err);
    }
  })();
})();
