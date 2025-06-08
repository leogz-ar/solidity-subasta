## Para desplegar:
- 1 - Pegalo en Remix y compilá con Solidity 0.8.20 o superior.
- 2 - En el campo _duracionMinutos, poné por ejemplo: 60 (es el tiempo en minutos que dura la subasta)
- 3 - En _ofertaInicial, poné: 10000000000000000 (que es 0.01 ETH que se usa como oferta inicial)
- 4 - En VALUE, poné ese mismo valor: 10000000000000000, y seleccioná la unidad wei.
- 5 - Deploy

### 💻 Frontend
https://leogz-ar.github.io/solidity-subasta/

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Mod2Subasta -> Contrato para Subasta
contract SubastaLeo {
    address public owner;              // dirección del creador (owner) de la subasta
    uint256 public ofertaMaxima;       // monto de la oferta más alta actual
    address public ganador;            // dirección del actual ganador (addess del que ofertó)
    uint256 public finSubasta;         // momento (timestamp) en que finaliza la subasta
    bool public subastaActiva;         // estado de la subasta: activa o finalizada

    // estructura para registrar las ofertas
    struct Oferta {
        address ofertante;
        uint256 monto;
    }

    Oferta[] public historialOfertas;                    // historial completo de ofertas (en orden ofertante > monto)
    mapping(address => uint256) public depositos;        // total depositado por cada usuario (por address)
    mapping(address => uint256[]) public ofertasUsuario; // historial de ofertas por usuario (para cálculo de excedente)

    event NuevaOferta(address ofertante, uint256 monto);            //notifica nueva oferta
    event SubastaFinalizada(address ganador, uint256 montoGanador); //notifica que termino la subasta

    // constructor que inicia la subasta
    // _duracionMinutos Duración de la subasta en minutos
    // _ofertaInicial Monto mínimo inicial (en wei), enviado junto al despliegue
    constructor(uint256 _duracionMinutos, uint256 _ofertaInicial) payable {
        require(msg.value >= _ofertaInicial, "Se debe enviar al menos la oferta inicial");

        owner = msg.sender;
        ofertaMaxima = msg.value;
        ganador = msg.sender;
        finSubasta = block.timestamp + (_duracionMinutos * 1 minutes);
        subastaActiva = true;

        //registró la oferta inicial
        historialOfertas.push(Oferta(msg.sender, msg.value));
        ofertasUsuario[msg.sender].push(msg.value);
        depositos[msg.sender] += msg.value;
    }

    // modificador para funciones que solo puede llamar el owner (el que desplego el contrato)
    modifier soloOwner() {
        require(msg.sender == owner, "No tiene permisos para hacer esto... ");
        _;
    }

    // modificador para funciones que requieren que la subasta siga activa
    modifier mientrasActiva() {
        require(subastaActiva, "La subasta ya finalizo");
        _;
    }

    // Realiza una oferta
    // requiere ser al menos 5% superior a la actual. Si es en los últimos 10 minutos, extiende la subasta.
    function ofertar() external payable mientrasActiva {
        require(block.timestamp <= finSubasta, "La subasta termino");
        require(msg.value >= ofertaMaxima + (ofertaMaxima * 5) / 100, "La ofertar debe ser al menos 5% superior que la actual");

        // extiende la subasta si se oferta en los últimos 10 minutos
        if (finSubasta - block.timestamp <= 10 minutes) {
            finSubasta += 10 minutes;
        }

        // registra la nueva oferta
        depositos[msg.sender] += msg.value;
        historialOfertas.push(Oferta(msg.sender, msg.value));
        ofertasUsuario[msg.sender].push(msg.value);

        ofertaMaxima = msg.value;
        ganador = msg.sender;

        emit NuevaOferta(msg.sender, msg.value);
    }

    // muestra la dirección y el monto del ganador
    function verGanador() external view returns (address, uint256) {
        return (ganador, ofertaMaxima);
    }

    // muestra una oferta del historial según su índice
    function verOfertaPorIndice(uint256 indice) external view returns (address, uint256) {
        require(indice < historialOfertas.length, "Indice fuera de rango");
        Oferta memory o = historialOfertas[indice];
        return (o.ofertante, o.monto);
    }

    // muestra la cantidad total de ofertas realizadas
    function totalOfertas() external view returns (uint256) {
        return historialOfertas.length;
    }

    // finaliza la subasta y devuelve los depósitos (restando la comisión) a los perdedores
    // el ganador no recibe reembolso. Los perdedores reciben el 98% de su depósito.
    function finalizarSubasta() external soloOwner mientrasActiva {
        require(block.timestamp > finSubasta, "La subasta no ha terminado");
        subastaActiva = false;

        for (uint256 i = 0; i < historialOfertas.length; i++) {
            address ofertante = historialOfertas[i].ofertante;

            // si no es el ganador, se devuelve su deposito con 2% de comisión
            if (ofertante != ganador && depositos[ofertante] > 0) {
                uint256 comision = (depositos[ofertante] * 2) / 100;
                uint256 reembolso = depositos[ofertante] - comision;
                depositos[ofertante] = 0;
                payable(ofertante).transfer(reembolso);
            }
        }

        emit SubastaFinalizada(ganador, ofertaMaxima);
    }

    // permite retirar ofertas anteriores en caso de haber ofertado varias veces
    // solo deja retenida la última oferta (más alta), y devuelve el resto
    function retirarExcedente() external mientrasActiva {
        uint256 total = ofertasUsuario[msg.sender].length;
        require(total > 1, "No hay excedente disponible");

        uint256 excedente = 0;

        // suma todas las ofertas anteriores excepto la última
        for (uint256 i = 0; i < total - 1; i++) {
            excedente += ofertasUsuario[msg.sender][i];
            ofertasUsuario[msg.sender][i] = 0; // marcar como retirada
        }

        require(excedente > 0, "No hay excedente para retirar");
        depositos[msg.sender] -= excedente;
        payable(msg.sender).transfer(excedente);
    }

    // permite al owner retirar los fondos del contrato despues de finalizar la subasta
    function retirarFondos() external soloOwner {
        require(!subastaActiva, "Primero finaliza la subasta");
        uint256 saldo = address(this).balance;
        payable(owner).transfer(saldo);
    }
}
```
