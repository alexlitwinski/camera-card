/**
 * Camera Card para Home Assistant
 * 
 * Este componente mostra:
 * - FPS da câmera
 * - Uso de CPU
 * - Informações de conexão
 * - Botão para reconectar a câmera
 * - Switch para ligar/desligar a alimentação da câmera
 * - Suporte para abrir a imagem da câmera ao clicar no título
 * 
 * Versão: 1.3.1
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
    
    if (!config.process_fps_sensor) {
      throw new Error('Você precisa definir um sensor de process FPS (process_fps_sensor)');
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
    
    // camera_entity é opcional
    
    this.config = config;
    this.render();
  }

  // Atualiza o card quando há mudanças
  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  // Função para abrir a visualização da câmera
  _openCameraView() {
    if (!this._hass || !this.config || !this.config.camera_entity) {
      console.log('Entidade da câmera não configurada');
      return;
    }
    
    // Verifica se a entidade da câmera existe
    const cameraEntity = this.config.camera_entity;
    if (!this._hass.states[cameraEntity]) {
      console.error(`Entidade da câmera não encontrada: ${cameraEntity}`);
      return;
    }
    
    // Dispara o evento para abrir a visualização mais-info da câmera
    const event = new CustomEvent('hass-more-info', {
      detail: {
        entityId: cameraEntity
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
    
    console.log(`Abrindo visualização da câmera: ${cameraEntity}`);
  }

  // Função para reconectar a câmera
  _reconnectCamera() {
    if (!this._hass || !this.config || !this.config.ap_entity) {
      console.error('Dados necessários não disponíveis para reconectar a câmera');
      return;
    }
    
    // Obter referência ao botão para adicionar feedback visual
    const reconnectButton = this.shadowRoot.querySelector('#reconnect-btn');
    
    // Armazenar o texto original do botão
    const originalButtonText = reconnectButton.innerHTML;
    
    // Alterar o botão para mostrar feedback visual
    reconnectButton.innerHTML = '<ha-icon icon="mdi:loading" class="loading-icon"></ha-icon> Reconectando...';
    reconnectButton.style.backgroundColor = '#0D3880'; // Azul mais escuro durante o processo
    reconnectButton.disabled = true;
    
    // Adicionar estilo para o ícone de carregamento girando
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .loading-icon {
        animation: spin 1s linear infinite;
      }
    `;
    this.shadowRoot.appendChild(styleEl);
    
    const apState = this._hass.states[this.config.ap_entity];
    
    if (!apState || !apState.attributes) {
      console.error('Estado da entidade AP não disponível');
      // Restaurar o botão
      reconnectButton.innerHTML = originalButtonText;
      reconnectButton.disabled = false;
      reconnectButton.style.backgroundColor = '#1a4b8c';
      return;
    }
    
    // Obter e formatar o MAC address
    let macAddress = apState.attributes.mac || '';
    
    if (!macAddress) {
      console.error('MAC address da câmera não encontrado');
      // Restaurar o botão
      reconnectButton.innerHTML = originalButtonText;
      reconnectButton.disabled = false;
      reconnectButton.style.backgroundColor = '#1a4b8c';
      return;
    }
    
    // Converter o formato do MAC
    const formattedMac = macAddress.replace(/:/g, '-').toUpperCase();
    
    console.log('MAC original:', macAddress);
    console.log('MAC formatado:', formattedMac);
    
    // Chamar o serviço com o MAC formatado
    this._hass.callService('tplink_omada', 'reconnect_client', {
      mac: formattedMac
    }).then(() => {
      console.log('Comando de reconexão enviado com sucesso');
      
      // Feedback de sucesso
      reconnectButton.innerHTML = '<ha-icon icon="mdi:check"></ha-icon> Enviado!';
      reconnectButton.style.backgroundColor = '#2ecc71'; // Verde para sucesso
      
      // Mostrar uma notificação de toast (se disponível)
      if (this._hass.callService && typeof this._hass.callService === 'function') {
        try {
          this._hass.callService('persistent_notification', 'create', {
            title: 'Camera Card',
            message: `Comando de reconexão enviado (MAC: ${formattedMac})`
          });
        } catch (e) {
          console.error('Erro ao criar notificação:', e);
        }
      }
      
      // Restaurar o botão após 3 segundos
      setTimeout(() => {
        reconnectButton.innerHTML = originalButtonText;
        reconnectButton.disabled = false;
        reconnectButton.style.backgroundColor = '#1a4b8c';
      }, 3000);
    }).catch(error => {
      console.error('Erro ao reconectar câmera:', error);
      
      // Feedback de erro
      reconnectButton.innerHTML = '<ha-icon icon="mdi:alert"></ha-icon> Erro!';
      reconnectButton.style.backgroundColor = '#e74c3c'; // Vermelho para erro
      
      // Restaurar o botão após 3 segundos
      setTimeout(() => {
        reconnectButton.innerHTML = originalButtonText;
        reconnectButton.disabled = false;
        reconnectButton.style.backgroundColor = '#1a4b8c';
      }, 3000);
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

  // Método para obter o estilo de fundo baseado no FPS
  _getBackgroundStyle(processFps, detectionFps) {
    // Converte os valores para número
    const processFpsValue = parseFloat(processFps);
    const detectionFpsValue = parseFloat(detectionFps);
    
    // Define o estilo com base nos valores dos FPS
    if (processFpsValue === 0) {
      return 'background-color: #ffe5e5;'; // Vermelho claro quando process_fps = 0
    } else if (detectionFpsValue > 0) {
      return 'background-color: #d4edff;'; // Azul claro quando detection_fps > 0
    } else {
      return 'background-color: #ffffff;'; // Branco para outros casos
    }
  }

  // Renderiza o conteúdo do card
  render() {
    if (!this._hass || !this.config) {
      return;
    }
    
    const fpsSensor = this.config.fps_sensor;
    const processFpsSensor = this.config.process_fps_sensor;
    const cpuSensor = this.config.cpu_sensor;
    const powerSwitch = this.config.power_switch;
    const apEntity = this.config.ap_entity;
    const rssiSensor = this.config.rssi_sensor;
    const snrSensor = this.config.snr_sensor;
    const cameraEntity = this.config.camera_entity;
    
    // Obtém estados das entidades
    const fpsState = this._hass.states[fpsSensor];
    const processFpsState = this._hass.states[processFpsSensor];
    const cpuState = this._hass.states[cpuSensor];
    const switchState = this._hass.states[powerSwitch];
    const apState = this._hass.states[apEntity];
    
    if (!fpsState || !processFpsState || !cpuState || !switchState || !apState) {
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
    const hasCameraEntity = cameraEntity && this._hass.states[cameraEntity];
    
    // Define título do card
    const cardTitle = this.config.title || 'Camera Card';
    
    // Obtém valores dos sensores
    const fps = fpsState.state;
    const processFps = processFpsState.state;
    const cpu = parseFloat(cpuState.state);
    const cpuPercent = Math.min(cpu, 100); // Para a barra de progresso
    const isPowerOn = switchState.state === 'on';
    
    // Obtém o estilo de fundo baseado nos valores de FPS
    const backgroundStyle = this._getBackgroundStyle(processFps, fps);
    
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
          ${backgroundStyle}
        }
        
        .card-header {
          padding: 14px 20px;
          background-color: var(--background-color);
          color: var(--text-color);
          font-weight: 500;
          font-size: 18px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        /* Mantém apenas o cursor */
        .card-header.clickable {
          cursor: pointer;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          flex: 1;
        }
        
        .header-right {
          margin-left: 8px;
          opacity: 0.7;
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
          padding: 16px 20px;
        }
        
        .info-section {
          background-color: var(--secondary-background-color);
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 15px;
        }
        
        .info-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          margin-bottom: 8px;
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
          margin: 8px 0;
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
          margin-top: 15px;
        }
        
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .reconnect-button {
          background-color: #1a4b8c !important;
          color: white !important;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 6px rgba(26, 75, 140, 0.2);
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
        
        /* Hack para ajustar a aparência do switch */
        ha-switch {
          --mdc-theme-secondary: var(--primary-color);
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-icon {
          animation: spin 1s linear infinite;
        }
      </style>
      
      <ha-card>
        <div class="card-header ${hasCameraEntity ? 'clickable' : ''}" id="card-header">
          <div class="header-left">
            <span class="header-icon"><ha-icon icon="mdi:video"></ha-icon></span>
            ${cardTitle}
            <span class="status-indicator ${isPowerOn ? 'status-online' : 'status-offline'}"></span>
          </div>
          ${hasCameraEntity ? '<div class="header-right"><ha-icon icon="mdi:chevron-right" style="color: var(--secondary-text-color);"></ha-icon></div>' : ''}
        </div>
        
        <div class="card-content">
          <div class="info-section">
            <div class="info-title">
              <ha-icon icon="mdi:chart-line"></ha-icon> Métricas de Desempenho
            </div>
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:speedometer"></ha-icon> FPS:</span>
              <span class="info-value">${fps}</span>
            </div>
            
            <div class="info-row">
              <span class="info-label"><ha-icon icon="mdi:speedometer-medium"></ha-icon> Process FPS:</span>
              <span class="info-value">${processFps}</span>
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
      
      // Adiciona event listener para o cabeçalho da câmera se a entidade da câmera estiver configurada
      if (hasCameraEntity) {
        this.shadowRoot.querySelector('#card-header').addEventListener('click', () => this._openCameraView());
      }
    } else {
      const root = this.shadowRoot.querySelector('div');
      root.innerHTML = cardHTML;
      
      // Adiciona event listeners
      this.shadowRoot.querySelector('#reconnect-btn').addEventListener('click', () => this._reconnectCamera());
      this.shadowRoot.querySelector('#power-switch').addEventListener('change', () => this._togglePower());
      
      // Adiciona event listener para o cabeçalho da câmera se a entidade da câmera estiver configurada
      if (hasCameraEntity) {
        this.shadowRoot.querySelector('#card-header').addEventListener('click', () => this._openCameraView());
      }
    }
  }

  // Obtém o tamanho do card
  getCardSize() {
    return 3;
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
