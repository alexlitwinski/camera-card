/**
 * Camera Card para Home Assistant
 * 
 * Este componente mostra:
 * - Imagem da câmera
 * - FPS da câmera
 * - Uso de CPU
 * - Botão para reconectar a câmera
 * - Switch para ligar/desligar a alimentação da câmera
 * 
 * Versão: 1.1.0
 * Tema: Claro
 */

class CameraCard extends HTMLElement {
  // Define as propriedades do card
  static get properties() {
    return {
      hass: Object,
      config: Object,
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Configurações do card
  setConfig(config) {
    if (!config.camera_entity) {
      throw new Error('Você precisa definir uma entidade de câmera (camera_entity)');
    }
    
    if (!config.fps_sensor) {
      throw new Error('Você precisa definir um sensor de FPS (fps_sensor)');
    }
    
    if (!config.cpu_sensor) {
      throw new Error('Você precisa definir um sensor de uso de CPU (cpu_sensor)');
    }
    
    if (!config.power_switch) {
      throw new Error('Você precisa definir um switch de alimentação (power_switch)');
    }
    
    if (!config.mac_address) {
      throw new Error('Você precisa definir o endereço MAC do dispositivo (mac_address)');
    }
    
    this.config = config;
    this.render();
  }

  // Atualiza o card quando há mudanças
  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  // Função para reconectar a câmera
  _reconnectCamera() {
    this._hass.callService('tplink_omada', 'reconnect_client', {
      mac: this.config.mac_address
    });
  }

  // Função para alternar a alimentação da câmera
  _togglePower() {
    const switchState = this._hass.states[this.config.power_switch];
    const service = switchState.state === 'on' ? 'turn_off' : 'turn_on';
    
    this._hass.callService('switch', service, {
      entity_id: this.config.power_switch
    });
  }

  // Função para abrir a câmera em tela cheia
  _openFullscreen() {
    this._hass.callService('camera', 'play_stream', {
      entity_id: this.config.camera_entity,
      format: 'hls'
    });
  }

  // Função para capturar uma imagem
  _captureSnapshot() {
    this._hass.callService('camera', 'snapshot', {
      entity_id: this.config.camera_entity,
      filename: `/config/www/camera_snapshots/${this.config.camera_entity.split('.')[1]}_${new Date().toISOString().replace(/:/g, '-')}.jpg`
    });
  }

  // Renderiza o conteúdo do card
  render() {
    if (!this._hass || !this.config) {
      return;
    }
    
    const cameraEntity = this.config.camera_entity;
    const fpsSensor = this.config.fps_sensor;
    const cpuSensor = this.config.cpu_sensor;
    const powerSwitch = this.config.power_switch;
    
    // Obtém estados das entidades
    const cameraState = this._hass.states[cameraEntity];
    const fpsState = this._hass.states[fpsSensor];
    const cpuState = this._hass.states[cpuSensor];
    const switchState = this._hass.states[powerSwitch];
    
    if (!cameraState || !fpsState || !cpuState || !switchState) {
      this.shadowRoot.innerHTML = `
        <ha-card header="Camera Card - Erro">
          <div class="card-content">
            Uma ou mais entidades não foram encontradas. Verifique sua configuração.
          </div>
        </ha-card>
      `;
      return;
    }
    
    // Define título do card
    const cardTitle = this.config.title || cameraState.attributes.friendly_name || 'Camera Card';
    
    // Obtém valores dos sensores
    const fps = fpsState.state;
    const cpu = parseFloat(cpuState.state);
    const cpuPercent = (cpu / 100) * 100; // Para a barra de progresso
    const isPowerOn = switchState.state === 'on';
    
    // Timestamp para evitar cache da imagem
    const timestamp = new Date().getTime();
    
    // Carrega os estilos de ícones
    const iconStylesheet = document.createElement('link');
    iconStylesheet.setAttribute('rel', 'stylesheet');
    iconStylesheet.setAttribute('href', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
    
    // Cria o template do card
    const cardHTML = `
      <style>
        :host {
          --primary-color: var(--card-primary-color, #4b7bec);
          --text-color: var(--card-text-color, #32325d);
          --secondary-text-color: var(--card-secondary-text-color, #6b7c93);
          --background-color: var(--card-background-color, #ffffff);
          --secondary-background-color: var(--card-secondary-background-color, #f8f9fc);
          --border-color: var(--card-border-color, #f0f2f5);
          --shadow-color: var(--card-shadow-color, rgba(0,0,0,0.08));
          --border-radius: var(--card-border-radius, 12px);
        }
        
        ha-card {
          border-radius: var(--border-radius);
          background-color: var(--background-color);
          color: var(--text-color);
          box-shadow: 0 4px 15px var(--shadow-color);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        ha-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }
        
        .card-header {
          padding: 18px 24px;
          background-color: var(--background-color);
          color: var(--text-color);
          font-weight: 500;
          font-size: 18px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .header-left {
          display: flex;
          align-items: center;
        }
        
        .header-icon {
          margin-right: 10px;
          color: var(--primary-color);
          font-size: 18px;
        }
        
        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          margin-left: 10px;
        }
        
        .status-online {
          background-color: #2ecc71;
        }
        
        .status-offline {
          background-color: #e74c3c;
        }
        
        .card-content {
          padding: 20px 24px;
        }
        
        .camera-container {
          position: relative;
          width: 100%;
          margin-bottom: 20px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        
        .camera-image {
          width: 100%;
          display: block;
          transition: filter 0.3s;
        }
        
        .camera-offline {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .camera-controls-overlay {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: rgba(255,255,255,0.8);
          border-radius: 20px;
          padding: 5px 10px;
          display: flex;
          gap: 8px;
        }
        
        .camera-control-btn {
          background: none;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          font-size: 16px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }
        
        .camera-control-btn:hover {
          background-color: rgba(75, 123, 236, 0.1);
        }
        
        .info-section {
          background-color: var(--secondary-background-color);
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .info-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
        }
        
        .info-title i {
          margin-right: 8px;
          color: var(--primary-color);
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 12px 0;
          color: var(--text-color);
          font-size: 14px;
          align-items: center;
        }
        
        .info-label {
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        
        .info-label i {
          margin-right: 8px;
          width: 20px;
          text-align: center;
          color: var(--primary-color);
        }
        
        .info-value {
          font-weight: 400;
          padding: 4px 12px;
          background-color: var(--background-color);
          border-radius: 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .cpu-bar {
          height: 6px;
          width: 60px;
          background-color: #eaeef6;
          border-radius: 3px;
          margin-left: 5px;
          overflow: hidden;
        }
        
        .cpu-fill {
          height: 100%;
          width: ${cpuPercent}%;
          background-color: var(--primary-color);
          border-radius: 3px;
        }
        
        .controls-section {
          margin-top: 20px;
        }
        
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .reconnect-button {
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.1s;
          box-shadow: 0 4px 6px rgba(75, 123, 236, 0.2);
        }
        
        .reconnect-button:hover {
          background-color: #3867d6;
          transform: translateY(-2px);
        }
        
        .reconnect-button:active {
          transform: translateY(0);
        }
        
        .switch-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .switch-label {
          color: var(--secondary-text-color);
          font-size: 14px;
          font-weight: 500;
        }
        
        .tooltip {
          position: relative;
          display: inline-block;
        }

        .tooltip .tooltiptext {
          visibility: hidden;
          width: 120px;
          background-color: var(--text-color);
          color: white;
          text-align: center;
          border-radius: 6px;
          padding: 5px 0;
          position: absolute;
          z-index: 1;
          bottom: 125%;
          left: 50%;
          margin-left: -60px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .tooltip:hover .tooltiptext {
          visibility: visible;
          opacity: 1;
        }
        
        /* Hack para ajustar a aparência do switch */
        ha-switch {
          --mdc-theme-secondary: var(--primary-color);
        }
      </style>
      
      <ha-card>
        <div class="card-header">
          <div class="header-left">
            <i class="fas fa-video header-icon"></i>
            ${cardTitle}
            <span class="status-indicator ${isPowerOn ? 'status-online' : 'status-offline'}"></span>
          </div>
          <div class="tooltip">
            <i class="fas fa-circle-info" style="color: var(--primary-color); cursor: pointer;"></i>
            <span class="tooltiptext">Camera ID: ${cameraEntity}</span>
          </div>
        </div>
        
        <div class="card-content">
          <div class="camera-container">
            <img 
              class="camera-image" 
              src="${isPowerOn ? `/api/camera_proxy/${cameraEntity}?${timestamp}` : '#'}" 
              style="${!isPowerOn ? 'filter: grayscale(1) brightness(0.7);' : ''}"
              alt="Camera Feed"
            >
            ${!isPowerOn ? '<div class="camera-offline">Câmera desligada</div>' : ''}
            ${isPowerOn ? `
            <div class="camera-controls-overlay">
              <button class="camera-control-btn tooltip" id="fullscreen-btn">
                <i class="fas fa-expand"></i>
                <span class="tooltiptext">Tela cheia</span>
              </button>
              <button class="camera-control-btn tooltip" id="snapshot-btn">
                <i class="fas fa-camera"></i>
                <span class="tooltiptext">Capturar</span>
              </button>
            </div>
            ` : ''}
          </div>
          
          <div class="info-section">
            <div class="info-title">
              <i class="fas fa-chart-line"></i> Métricas de Desempenho
            </div>
            <div class="info-row">
              <span class="info-label"><i class="fas fa-gauge-high"></i> FPS:</span>
              <span class="info-value">${fps}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label"><i class="fas fa-microchip"></i> CPU:</span>
              <div class="info-value" style="display: flex; align-items: center;">
                ${cpu}%
                <div class="cpu-bar">
                  <div class="cpu-fill"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="controls-section">
            <div class="controls-row">
              <button class="reconnect-button" id="reconnect-btn">
                <i class="fas fa-rotate"></i>
                Reconectar
              </button>
              
              <div class="switch-container">
                <span class="switch-label">Alimentação</span>
                <ha-switch
                  ?checked="${isPowerOn}"
                  id="power-switch">
                </ha-switch>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
    
    // Atualiza o shadow DOM
    if (!this.shadowRoot.querySelector('ha-card')) {
      this.shadowRoot.innerHTML = '';
      this.shadowRoot.appendChild(iconStylesheet);
      const root = document.createElement('div');
      root.innerHTML = cardHTML;
      this.shadowRoot.appendChild(root);
      
      // Adiciona event listeners
      this.shadowRoot.querySelector('#reconnect-btn').addEventListener('click', () => this._reconnectCamera());
      this.shadowRoot.querySelector('#power-switch').addEventListener('change', () => this._togglePower());
      
      const fullscreenBtn = this.shadowRoot.querySelector('#fullscreen-btn');
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => this._openFullscreen());
      }
      
      const snapshotBtn = this.shadowRoot.querySelector('#snapshot-btn');
      if (snapshotBtn) {
        snapshotBtn.addEventListener('click', () => this._captureSnapshot());
      }
    } else {
      const root = this.shadowRoot.querySelector('div');
      root.innerHTML = cardHTML;
      
      // Adiciona event listeners
      this.shadowRoot.querySelector('#reconnect-btn').addEventListener('click', () => this._reconnectCamera());
      this.shadowRoot.querySelector('#power-switch').addEventListener('change', () => this._togglePower());
      
      const fullscreenBtn = this.shadowRoot.querySelector('#fullscreen-btn');
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => this._openFullscreen());
      }
      
      const snapshotBtn = this.shadowRoot.querySelector('#snapshot-btn');
      if (snapshotBtn) {
        snapshotBtn.addEventListener('click', () => this._captureSnapshot());
      }
    }
  }

  // Obtém o tamanho do card
  getCardSize() {
    return 4;
  }
}

// Registra o card personalizado
customElements.define('camera-card', CameraCard);

// Informações para o HACS
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'camera-card',
  name: 'Camera Card',
  description: 'Card de câmera com informações de desempenho e controles',
  preview: true
});
