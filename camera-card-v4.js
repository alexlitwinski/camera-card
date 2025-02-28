// Função para capturar uma imagem
  _captureSnapshot() {
    this._hass.callService('camera', 'snapshot', {
      entity_id: this.config.camera_entity,
      filename: `/config/www/camera_snapshots/${this.config.camera_entity.split('.')[1]}_${new Date().toISOString().replace(/:/g, '-')}.jpg`
    });
  }/**
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
    if (!config.fps_sensor) {
      throw new Error('Você precisa definir um sensor de FPS (fps_sensor)');
    }
    
    if (!config.cpu_sensor) {
      throw new Error('Você precisa definir um sensor de uso de CPU (cpu_sensor)');
    }
    
    if (!config.power_switch) {
      throw new Error('Você precisa definir um switch de alimentação (power_switch)');
    }
    
    if (!config.ap_entity) {
      throw new Error('Você precisa definir a entidade do access point (ap_entity)');
    }
    
    if (config.rssi_sensor === undefined && config.snr_sensor === undefined) {
      throw new Error('Você precisa definir pelo menos um sensor de sinal (rssi_sensor ou snr_sensor)');
    }
    
    // A URL RTSP agora é obrigatória em vez da entidade de câmera
    if (!config.rtsp_url) {
      throw new Error('Você precisa definir a URL RTSP da câmera (rtsp_url)');
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
    const apState = this._hass.states[this.config.ap_entity];
    const macAddress = apState.attributes.mac || '';
    
    this._hass.callService('tplink_omada', 'reconnect_client', {
      mac: macAddress
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

  // Método para obter o estilo de fundo baseado no FPS
  _getBackgroundStyle(fps) {
    // Converte o valor para número
    const fpsValue = parseFloat(fps);
    
    // Define o estilo com base no valor do FPS
    if (fpsValue > 0) {
      return 'background-color: #d4edff;'; // Azul claro quando FPS > 0
    } else if (fpsValue === 0) {
      return 'background-color: #ffe5e5;'; // Vermelho claro quando FPS = 0
    } else {
      return ''; // Valor padrão para outros casos
    }
  }

  // Renderiza o conteúdo do card
  render() {
    if (!this._hass || !this.config) {
      return;
    }
    
    const fpsSensor = this.config.fps_sensor;
    const cpuSensor = this.config.cpu_sensor;
    const powerSwitch = this.config.power_switch;
    const apEntity = this.config.ap_entity;
    const rssiSensor = this.config.rssi_sensor;
    const snrSensor = this.config.snr_sensor;
    const rtspUrl = this.config.rtsp_url;
    
    // Obtém estados das entidades
    const fpsState = this._hass.states[fpsSensor];
    const cpuState = this._hass.states[cpuSensor];
    const switchState = this._hass.states[powerSwitch];
    const apState = this._hass.states[apEntity];
    
    if (!fpsState || !cpuState || !switchState || !apState) {
      this.shadowRoot.innerHTML = `
        <ha-card header="Camera Card - Erro">
          <div class="card-content">
            Uma ou mais entidades não foram encontradas. Verifique sua configuração.
          </div>
        </ha-card>
      `;
      return;
    }
    
    // Obtém informações adicionais
    const rssiState = rssiSensor ? this._hass.states[rssiSensor] : null;
    const snrState = snrSensor ? this._hass.states[snrSensor] : null;
    
    // Define título do card
    const cardTitle = this.config.title || 'Camera Card';
    
    // Obtém valores dos sensores
    const fps = fpsState.state;
    const cpu = parseFloat(cpuState.state);
    const cpuPercent = Math.min(cpu, 100); // Para a barra de progresso
    const isPowerOn = switchState.state === 'on';
    
    // Obtém o estilo de fundo baseado no FPS
    const backgroundStyle = this._getBackgroundStyle(fps);
    
    // Informações de conexão
    const rssiValue = rssiState ? parseFloat(rssiState.state) : null;
    const snrValue = snrState ? parseFloat(snrState.state) : null;
    
    // Converte RSSI (dBm) para percentual (aproximado)
    // Fórmula: 2 * (dBm + 100), limitado entre 0 e 100
    const rssiPercent = rssiValue !== null ? Math.min(Math.max(2 * (rssiValue + 100), 0), 100) : null;
    
    // Obtém informações do AP
    const apName = apState.attributes.ap_name || 'Desconhecido';
    const apMac = apState.attributes.ap_mac || '';
    const macAddress = apState.attributes.mac || '';
    const ipAddress = apState.attributes.ip || '';
    const channel = apState.attributes.channel || '';
    const radioType = apState.attributes.radio || '';
    const ssid = apState.attributes.ssid || '';
    
    // Timestamp para evitar cache da imagem
    const timestamp = new Date().getTime();
    
    // Material Icons para o Home Assistant que já estão disponíveis
    // Não precisamos carregar uma biblioteca externa de ícones
    
    // Cria o template do card
    const cardHTML = `
      <style>
        :host {
          --primary-color: var(--card-primary-color, var(--primary-color));
          --text-color: var(--card-text-color, var(--primary-text-color));
          --secondary-text-color: var(--card-secondary-text-color, var(--secondary-text-color));
          --background-color: var(--card-background-color, var(--card-background-color, var(--ha-card-background)));
          --secondary-background-color: var(--card-secondary-background-color, var(--secondary-background-color));
          --border-color: var(--card-border-color, var(--divider-color));
          --shadow-color: var(--card-shadow-color, rgba(0,0,0,0.08));
          --border-radius: var(--card-border-radius, var(--ha-card-border-radius, 12px));
        }
        
        ha-card {
          border-radius: var(--border-radius);
          background-color: var(--background-color);
          color: var(--text-color);
          box-shadow: 0 4px 15px var(--shadow-color);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          ${backgroundStyle}
        }
        
        .camera-video {
          width: 100%;
          border-radius: 8px;
          display: block;
        }
        
        .camera-offline-container {
          width: 100%;
          text-align: center;
          color: #666;
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
          display: flex;
          align-items: center;
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
            <span class="header-icon"><ha-icon icon="mdi:video"></ha-icon></span>
            ${cardTitle}
            <span class="status-indicator ${isPowerOn ? 'status-online' : 'status-offline'}"></span>
          </div>
          <div class="tooltip">
            <ha-icon icon="mdi:information-outline" style="color: var(--primary-color); cursor: pointer;"></ha-icon>
            <span class="tooltiptext">IP: ${ipAddress}<br>MAC: ${macAddress}</span>
          </div>
        </div>
        
        <div class="card-content">
          <div class="camera-container">
            ${isPowerOn ? `
            <video 
              class="camera-video" 
              autoplay 
              muted 
              playsinline
              style="width: 100%; height: auto; display: block;"
              id="rtsp-video"
              poster="/api/resources/static/images/placeholder.png"
            ></video>
            <script>
              // Função para inicializar o player de vídeo
              (function initVideo() {
                const videoElement = document.getElementById('rtsp-video');
                if (videoElement && window.Hls && window.Hls.isSupported()) {
                  const hls = new window.Hls();
                  // URL convertida RTSP -> HLS via servidor ou proxy
                  hls.loadSource("${this.config.rtsp_url.replace('rtsp://', 'http://').replace(':554', ':8888')}/index.m3u8");
                  hls.attachMedia(videoElement);
                  hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
                    videoElement.play().catch(e => {
                      console.warn('Autoplay failed:', e);
                    });
                  });
                } else if (videoElement && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                  // Safari suporta HLS nativamente
                  videoElement.src = "${this.config.rtsp_url.replace('rtsp://', 'http://').replace(':554', ':8888')}/index.m3u8";
                  videoElement.addEventListener('loadedmetadata', function() {
                    videoElement.play().catch(e => {
                      console.warn('Autoplay failed:', e);
                    });
                  });
                } else {
                  // Fallback para um iframe ou mensagem de erro
                  const container = videoElement.parentNode;
                  container.innerHTML = 
                    '<div style="padding: 20px; text-align: center; background-color: #f0f0f0; height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 8px;">' +
                    '<ha-icon icon="mdi:video-off" style="font-size: 48px; color: #999; margin-bottom: 16px;"></ha-icon>' +
                    '<div>Este navegador não suporta a reprodução de vídeo RTSP. Considere usar um conversor RTSP para HLS.</div>' +
                    '</div>';
                }
              })();
            </script>
            ` : `
            <div class="camera-offline-container" style="height: 240px; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f0f0f0; border-radius: 8px;">
              <ha-icon icon="mdi:video-off" style="font-size: 48px; color: #999; margin-bottom: 16px;"></ha-icon>
              <div class="camera-offline">Câmera desligada</div>
            </div>
            `}
            ${isPowerOn ? `
            <div class="camera-controls-overlay">
              <button class="camera-control-btn tooltip" id="fullscreen-btn">
                <ha-icon icon="mdi:fullscreen"></ha-icon>
                <span class="tooltiptext">Tela cheia</span>
              </button>
              <button class="camera-control-btn tooltip" id="snapshot-btn">
                <ha-icon icon="mdi:camera"></ha-icon>
                <span class="tooltiptext">Capturar</span>
              </button>
            </div>
            ` : ''}
          </div>
          
          <div class="info-section">
            <div class="info-title">
              <ha-icon icon="mdi:chart-line"></ha-icon> Métricas de Desempenho
            </div>
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:speedometer"></ha-icon> FPS:</span>
              <span class="info-value">${fps}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:cpu-64-bit"></ha-icon> CPU:</span>
              <div class="info-value" style="display: flex; align-items: center;">
                ${cpu}%
                <div class="cpu-bar">
                  <div class="cpu-fill"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-title">
              <ha-icon icon="mdi:wifi"></ha-icon> Informações de Conexão
            </div>
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:access-point"></ha-icon> Ponto de Acesso:</span>
              <span class="info-value" title="MAC: ${apMac}">${apName}</span>
            </div>
            
            ${rssiValue !== null ? `
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:signal"></ha-icon> RSSI:</span>
              <div class="info-value" style="display: flex; align-items: center;">
                ${rssiValue} dBm (${Math.round(rssiPercent)}%)
                <div class="cpu-bar" style="margin-left: 5px;">
                  <div class="cpu-fill" style="width: ${rssiPercent}%; background-color: ${rssiPercent > 70 ? '#2ecc71' : rssiPercent > 40 ? '#f39c12' : '#e74c3c'};"></div>
                </div>
              </div>
            </div>
            ` : ''}
            
            ${snrValue !== null ? `
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:signal-variant"></ha-icon> SNR:</span>
              <span class="info-value">${snrValue} dB</span>
            </div>
            ` : ''}
            
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:wifi-settings"></ha-icon> Rede:</span>
              <span class="info-value" title="Canal: ${channel}, ${radioType}">${ssid}</span>
            </div>
          </div>
          
          <div class="controls-section">
            <div class="controls-row">
              <button class="reconnect-button" id="reconnect-btn">
                <ha-icon icon="mdi:refresh"></ha-icon>
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
