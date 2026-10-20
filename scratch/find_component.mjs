async function test() {
  const res = await fetch('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
  const txt = await res.text();
  let pos = 0;
  while ((pos = txt.indexOf('Component("firestore"', pos)) !== -1) {
    console.log(txt.substring(pos - 50, pos + 250));
    pos += 20;
  }
  pos = 0;
  while ((pos = txt.indexOf('firestore-internal', pos)) !== -1) {
    console.log(txt.substring(pos - 50, pos + 250));
    pos += 20;
  }
}
test();
