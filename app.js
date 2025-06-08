let provider, signer, contract, currentAccount;

async function init() {
  if (typeof window.ethereum === 'undefined') {
    document.getElementById('wallet').innerText = "❌ MetaMask no detectado";
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  currentAccount = await signer.getAddress();

  document.getElementById('wallet').innerText = `🟢 Conectado: ${currentAccount}`;

  contract = new ethers.Contract(window.contractAddress, window.contractABI, signer);

  cargarOfertaMaxima();
  cargarOfertas();
  verificarOwner();
  cargarGanador();
}

async function cargarOfertaMaxima() {
  const max = await contract.ofertaMaxima();
  document.getElementById('maxBid').innerText = `${ethers.formatEther(max)} ETH`;
}

async function ofertar() {
  const input = document.getElementById('bidAmount');
  const ethAmount = input.value;

  if (!ethAmount || isNaN(ethAmount) || Number(ethAmount) <= 0) {
    alert("Ingresá un monto válido.");
    return;
  }

  const tx = await contract.ofertar({ value: ethers.parseEther(ethAmount) });
  await tx.wait();
  alert("✅ Oferta enviada con éxito");
  input.value = "";
  cargarOfertaMaxima();
  cargarOfertas();
}

async function cargarOfertas() {
  const total = await contract.totalOfertas();
  const list = document.getElementById('offersList');
  list.innerHTML = "";

  for (let i = 0; i < total; i++) {
    const oferta = await contract.verOfertaPorIndice(i);
    const li = document.createElement("li");
    li.innerText = `${oferta[0]} → ${ethers.formatEther(oferta[1])} ETH`;
    list.appendChild(li);
  }
}

async function cargarGanador() {
  const activa = await contract.subastaActiva();
  if (!activa) {
    const [addr, monto] = await contract.verGanador();
    document.getElementById('winner').innerText = `${addr} con ${ethers.formatEther(monto)} ETH`;
  }
}

async function verificarOwner() {
  const owner = await contract.owner();
  if (owner.toLowerCase() === currentAccount.toLowerCase()) {
    document.getElementById('adminControls').style.display = "block";
  }
}

async function finalizar() {
  const tx = await contract.finalizarSubasta();
  await tx.wait();
  alert("✅ Subasta finalizada");
  cargarGanador();
}

async function retirarExcedente() {
  try {
    const tx = await contract.retirarExcedente();
    await tx.wait();
    alert("✅ Excedente retirado con éxito.");
    cargarOfertaMaxima();
    cargarOfertas();
  } catch (err) {
    alert("⚠️ No se pudo retirar excedente.\n" + (err?.reason || err.message));
  }
}

window.onload = init;
