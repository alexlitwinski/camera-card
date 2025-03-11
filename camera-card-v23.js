/**
 * Camera Card para Home Assistant - Versão Otimizada
 * 
 * Este componente mostra:
 * - FPS da câmera
 * - Uso de CPU
 * - Informações de conexão
 * - Botão para reconectar a câmera (somente se ap_entity estiver configurado)
 * - Switch para ligar/desligar a alimentação da câmera
 * - Suporte para abrir a imagem da câmera ao clicar no título
 * - Indicação "Conectado via cabo" quando rssi_sensor e snr_sensor não estiverem presentes
 * 
 * Versão: 1.5.0
 * Tema: Claro
 */

class CameraCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Cache para elementos DOM e templates
    this._cache = {
      elements: {},
      lastStates: {},
      template: null
    };
    
    // Criar estilos uma única vez
    this._setupStyles();
    
    // Flags para controle de renderização
    this._isInitialRender = true;
    this._pendingUpdate = false;
    this._updateTimerId = null;
  }

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
    
    // ap_entity, rssi_sensor e snr_sensor não são mais obrigatórios
    
    this.config = config;
    this._isInitialRender = true;
  }

  set hass(hass) {
    this._hass = hass;
    
    // Verifica se os estados das entidades mudaram antes de renderizar
    if (this._shouldUpdate()) {
      // Usa throttling para evitar múltiplas renderizações em sequência
      this._throttledUpdate();
    }
  }

  _shouldUpdate() {
    if (!this._hass || !this.config) return false;
    if (this._isInitialRender) return true;
    
    const entitiesToCheck = [
      this.config.fps_sensor,
      this.config.process_fps_sensor,
      this.config.cpu_sensor,
      this.config.power_switch
    ];
    
    // Adiciona entidades opcionais à lista apenas se estiverem definidas
    if (this.config.ap_entity) entitiesToCheck.push(this.config.ap_entity);
    if (this.config.rssi_sensor) entitiesToCheck.push(this.config.rssi_sensor);
    if (this.config.snr_sensor) entitiesToCheck.push(this.config.snr_sensor);
    
    const entitiesChanged = this._checkEntitiesChanged(entitiesToCheck);
    
    return entitiesChanged;
  }
  
  _checkEntitiesChanged(entityIds) {
    const cache = this._cache.lastStates;
    let hasChanged = false;
    
    entityIds.filter(Boolean).forEach(entityId => {
      const currentState = this._hass.states[entityId];
      
      if (!currentState) return;
      
      const stateKey = `${entityId}_${currentState.state}_${JSON.stringify(currentState.attributes)}`;
      const lastStateKey = cache[entityId];
      
      if (stateKey !== lastStateKey) {
        cache[entityId] = stateKey;
        hasChanged = true;
      }
    });
    
    return hasChanged;
  }

  _throttledUpdate() {
    if (this._updateTimerId !== null) {
      clearTimeout(this._updateTimerId);
    }
    
    this._updateTimerId = setTimeout(() => {
      this._updateTimerId = null;
      this._updateCard();
    }, 100); // 100ms de debounce
  }

  _updateCard() {
    if (!this._hass || !this.config) return;
    
    if (this._isInitialRender) {
      this._setupCard();
      this._isInitialRender = false;
    } else {
      this._updateValues();
    }
  }

  _setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
      
      .wired-connection {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 12px 0;
        padding: 8px;
        color: var(--secondary-text-color);
        font-size: 14px;
        background-color: var(--background-color);
        border-radius: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      }
      
      .wired-connection ha-icon {
        margin-right: 8px;
        color: var(--primary-color);
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
        border-radius: 3px;
        background-color: var(--primary-color);
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
        background-color: #1a4b8c;
        color: white;
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
    `;
    
    this.shadowRoot.appendChild(style);
  }

  _setupCard() {
    const card = document.createElement('ha-card');
    this.shadowRoot.appendChild(card);
    
    // Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    card.appendChild(cardHeader);
    
    // Conteúdo
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';
    card.appendChild(cardContent);
    
    // Métricas de Desempenho
    const perfSection = this._createSection(
      'mdi:chart-line', 
      'Métricas de Desempenho', 
      [
        { label: 'mdi:speedometer', id: 'fps', text: 'FPS:' },
        { label: 'mdi:speedometer-medium', id: 'process-fps', text: 'Process FPS:' },
        { label: 'mdi:cpu-64-bit', id: 'cpu', text: 'CPU:', hasCpuBar: true }
      ]
    );
    cardContent.appendChild(perfSection);
    
    // Informações de Conexão
    const connSection = this._createSection(
      'mdi:wifi', 
      'Informações de Conexão', 
      [
        { label: 'mdi:access-point', id: 'ap', text: 'Ponto de Acesso:' },
        { label: 'mdi:signal', id: 'rssi', text: 'RSSI:', hasRssiBar: true },
        { label: 'mdi:signal-variant', id: 'snr', text: 'SNR:' },
        { label: 'mdi:wifi-settings', id: 'network', text: 'Rede:' }
      ]
    );
    cardContent.appendChild(connSection);
    
    // Verifica se precisamos mostrar a mensagem "Conectado via cabo"
    const hasWirelessInfo = this.config.rssi_sensor || this.config.snr_sensor;
    
    if (!hasWirelessInfo) {
      // Não temos informações wireless, mostrar mensagem de conexão com cabo
      const wiredConnection = document.createElement('div');
      wiredConnection.className = 'wired-connection';
      wiredConnection.innerHTML = '<ha-icon icon="mdi:ethernet"></ha-icon> Conectado via cabo';
      connSection.appendChild(wiredConnection);
    }
    
    // Controles
    const controlsSection = document.createElement('div');
    controlsSection.className = 'controls-section';
    
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    
    // Botão reconnect - apenas se ap_entity estiver configurado
    if (this.config.ap_entity) {
      const reconnectBtn = document.createElement('button');
      reconnectBtn.className = 'reconnect-button';
      reconnectBtn.id = 'reconnect-btn';
      reconnectBtn.innerHTML = '<ha-icon icon="mdi:refresh"></ha-icon> Reconectar';
      reconnectBtn.addEventListener('click', () => this._reconnectCamera());
      controlsRow.appendChild(reconnectBtn);
    }
    
    // Switch de alimentação
    const switchContainer = document.createElement('div');
    switchContainer.className = 'switch-container';
    
    const switchLabel = document.createElement('span');
    switchLabel.className = 'switch-label';
    switchLabel.textContent = 'Alimentação';
    switchContainer.appendChild(switchLabel);
    
    const powerSwitch = document.createElement('ha-switch');
    powerSwitch.id = 'power-switch';
    powerSwitch.addEventListener('change', () => this._togglePower());
    switchContainer.appendChild(powerSwitch);
    
    controlsRow.appendChild(switchContainer);
    
    // Só adiciona a seção de controles se tivermos elementos para mostrar
    if (controlsRow.children.length > 0) {
      controlsSection.appendChild(controlsRow);
      cardContent.appendChild(controlsSection);
    }
    
    // Armazena referências aos elementos para atualização
    this._cache.elements = {
      card,
      cardHeader,
      reconnectBtn: this.config.ap_entity ? this.shadowRoot.getElementById('reconnect-btn') : null,
      powerSwitch,
      fps: this.shadowRoot.getElementById('fps-value'),
      processFps: this.shadowRoot.getElementById('process-fps-value'),
      cpu: this.shadowRoot.getElementById('cpu-value'),
      ap: this.config.ap_entity ? this.shadowRoot.getElementById('ap-value') : null,
      rssi: this.config.rssi_sensor ? this.shadowRoot.getElementById('rssi-value') : null,
      snr: this.config.snr_sensor ? this.shadowRoot.getElementById('snr-value') : null,
      network: this.config.ap_entity ? this.shadowRoot.getElementById('network-value') : null
    };
    
    // Atualiza os valores iniciais
    this._updateValues();
  }

  _createSection(icon, title, rows) {
    const section = document.createElement('div');
    section.className = 'info-section';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'info-title';
    titleElement.innerHTML = `<ha-icon icon="${icon}"></ha-icon> ${title}`;
    section.appendChild(titleElement);
    
    rows.forEach(row => {
      // Pula criação da linha se a configuração relacionada não existir
      if ((row.id === 'ap' || row.id === 'network') && !this.config.ap_entity) return;
      if (row.id === 'rssi' && !this.config.rssi_sensor) return;
      if (row.id === 'snr' && !this.config.snr_sensor) return;
      
      const rowElement = document.createElement('div');
      rowElement.className = 'info-row';
      
      const label = document.createElement('span');
      label.className = 'info-label';
      label.innerHTML = `<ha-icon icon="${row.label}"></ha-icon> ${row.text}`;
      rowElement.appendChild(label);
      
      const value = document.createElement('span');
      value.className = 'info-value';
      value.id = `${row.id}-value`;
      
      if (row.hasCpuBar) {
        // Usamos a mesma abordagem do RSSI para a barra de CPU
        value.style.display = 'flex';
        value.style.alignItems = 'center';
        value.innerHTML = `0% <div class="cpu-bar" style="margin-left: 5px;"><div class="cpu-fill" style="width: 0%; background-color: #3498db;"></div></div>`;
      } else if (row.hasRssiBar) {
        value.style.display = 'flex';
        value.style.alignItems = 'center';
        value.innerHTML = `0 dBm (0%) <div class="cpu-bar" style="margin-left: 5px;"><div class="cpu-fill" style="width: 0%"></div></div>`;
      }
      
      rowElement.appendChild(value);
      section.appendChild(rowElement);
    });
    
    return section;
  }

  _updateValues() {
    if (!this._hass || !this.config || !this._cache.elements) return;
    
    const elements = this._cache.elements;
    
    // Verifica se todos os elementos necessários estão presentes
    if (!elements.card || !elements.cardHeader) return;
    
    // Obtém estados das entidades
    const fpsState = this._hass.states[this.config.fps_sensor];
    const processFpsState = this._hass.states[this.config.process_fps_sensor];
    const cpuState = this._hass.states[this.config.cpu_sensor];
    const switchState = this._hass.states[this.config.power_switch];
    
    if (!fpsState || !processFpsState || !cpuState || !switchState) {
      console.warn('Camera Card: Uma ou mais entidades não foram encontradas');
      return;
    }
    
    // Entidades opcionais
    const apState = this.config.ap_entity ? this._hass.states[this.config.ap_entity] : null;
    const rssiState = this.config.rssi_sensor ? this._hass.states[this.config.rssi_sensor] : null;
    const snrState = this.config.snr_sensor ? this._hass.states[this.config.snr_sensor] : null;
    const hasCameraEntity = this.config.camera_entity && this._hass.states[this.config.camera_entity];
    
    // Título do card
    const cardTitle = this.config.title || 'Camera Card';
    
    // Obtém valores dos sensores
    const fps = fpsState.state;
    const processFps = processFpsState.state;
    const cpu = parseFloat(cpuState.state);
    
    // Normaliza o percentual de CPU para um máximo de 5%
    // Para um máximo de 5%, divide por 5 e multiplica por 100 para obter o percentual da barra
    const cpuPercent = Math.min(cpu / 5 * 100, 100);
    
    // Define a cor da barra baseada no percentual (azul -> amarelo -> vermelho)
    const cpuBarColor = cpuPercent < 40 ? '#3498db' : cpuPercent < 70 ? '#f39c12' : '#e74c3c';
    
    const isPowerOn = switchState.state === 'on';
    
    // Define o estilo de fundo baseado nos valores de FPS
    elements.card.style.backgroundColor = this._getBackgroundColor(processFps, fps);
    
    // Atualiza o título e adiciona o evento para abrir a câmera se necessário
    const headerLeft = document.createElement('div');
    headerLeft.className = 'header-left';
    headerLeft.innerHTML = `
      <span class="header-icon"><ha-icon icon="mdi:video"></ha-icon></span>
      ${cardTitle}
      <span class="status-indicator ${isPowerOn ? 'status-online' : 'status-offline'}"></span>
    `;
    
    // Limpa o conteúdo anterior do cabeçalho
    elements.cardHeader.innerHTML = '';
    elements.cardHeader.appendChild(headerLeft);
    
    if (hasCameraEntity) {
      elements.cardHeader.className = 'card-header clickable';
      
      const headerRight = document.createElement('div');
      headerRight.className = 'header-right';
      headerRight.innerHTML = '<ha-icon icon="mdi:chevron-right" style="color: var(--secondary-text-color);"></ha-icon>';
      elements.cardHeader.appendChild(headerRight);
      
      // Remove event listener antigo se existir
      elements.cardHeader.removeEventListener('click', this._boundOpenCamera);
      
      // Cria uma referência à função ligada ao this para poder removê-la depois
      this._boundOpenCamera = () => this._openCameraView();
      elements.cardHeader.addEventListener('click', this._boundOpenCamera);
    } else {
      elements.cardHeader.className = 'card-header';
    }
    
    // Atualiza os valores nas seções de informação
    if (elements.fps) elements.fps.textContent = fps;
    if (elements.processFps) elements.processFps.textContent = processFps;
    
    // Atualiza o CPU usando a mesma abordagem que usamos para o RSSI
    if (elements.cpu) {
      elements.cpu.innerHTML = `${cpu}% <div class="cpu-bar" style="margin-left: 5px;"><div class="cpu-fill" style="width: ${cpuPercent}%; background-color: ${cpuBarColor};"></div></div>`;
      elements.cpu.title = "Escala da barra: máximo de 5% de CPU";
    }
    
    // Informações de conexão se disponíveis
    if (apState && elements.ap) {
      const apName = apState.attributes.ap_name || 'Desconhecido';
      const apMac = apState.attributes.ap_mac || '';
      elements.ap.textContent = apName;
      elements.ap.title = `MAC: ${apMac}`;
      
      // Informações de rede
      if (elements.network) {
        const ssid = apState.attributes.ssid || '';
        const channel = apState.attributes.channel || '';
        const radioType = apState.attributes.radio || '';
        
        elements.network.textContent = ssid;
        elements.network.title = `Canal: ${channel}, ${radioType}`;
      }
    }
    
    // RSSI
    if (rssiState && elements.rssi) {
      const rssiValue = parseFloat(rssiState.state);
      const rssiPercent = Math.min(Math.max(2 * (rssiValue + 100), 0), 100);
      
      elements.rssi.innerHTML = `${rssiValue} dBm (${Math.round(rssiPercent)}%) <div class="cpu-bar" style="margin-left: 5px;"><div class="cpu-fill" style="width: ${rssiPercent}%; background-color: ${rssiPercent > 70 ? '#2ecc71' : rssiPercent > 40 ? '#f39c12' : '#e74c3c'};"></div></div>`;
    }
    
    // SNR
    if (snrState && elements.snr) {
      elements.snr.textContent = `${snrState.state} dB`;
    }
    
    // Switch de alimentação
    if (elements.powerSwitch) {
      elements.powerSwitch.checked = isPowerOn;
    }
  }

  _getBackgroundColor(processFps, detectionFps) {
    const processFpsValue = parseFloat(processFps);
    const detectionFpsValue = parseFloat(detectionFps);
    
    if (processFpsValue === 0) {
      return '#ffe5e5'; // Vermelho claro
    } else if (detectionFpsValue > 0) {
      return '#d4edff'; // Azul claro
    } else {
      return '#ffffff'; // Branco
    }
  }

  _openCameraView() {
    if (!this._hass || !this.config || !this.config.camera_entity) {
      return;
    }
    
    const cameraEntity = this.config.camera_entity;
    if (!this._hass.states[cameraEntity]) {
      console.error(`Entidade da câmera não encontrada: ${cameraEntity}`);
      return;
    }
    
    const event = new CustomEvent('hass-more-info', {
      detail: { entityId: cameraEntity },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  _reconnectCamera() {
    if (!this._hass || !this.config || !this.config.ap_entity || !this._cache.elements.reconnectBtn) {
      return;
    }
    
    const reconnectButton = this._cache.elements.reconnectBtn;
    const originalButtonText = reconnectButton.innerHTML;
    
    // Feedback visual
    reconnectButton.innerHTML = '<ha-icon icon="mdi:loading" class="loading-icon"></ha-icon> Reconectando...';
    reconnectButton.style.backgroundColor = '#0D3880';
    reconnectButton.disabled = true;
    
    const apState = this._hass.states[this.config.ap_entity];
    
    if (!apState || !apState.attributes) {
      console.error('Estado da entidade AP não disponível');
      this._restoreButton(reconnectButton, originalButtonText);
      return;
    }
    
    const macAddress = apState.attributes.mac || '';
    
    if (!macAddress) {
      console.error('MAC address da câmera não encontrado');
      this._restoreButton(reconnectButton, originalButtonText);
      return;
    }
    
    const formattedMac = macAddress.replace(/:/g, '-').toUpperCase();
    
    this._hass.callService('tplink_omada', 'reconnect_client', {
      mac: formattedMac
    }).then(() => {
      reconnectButton.innerHTML = '<ha-icon icon="mdi:check"></ha-icon> Enviado!';
      reconnectButton.style.backgroundColor = '#2ecc71';
      
      setTimeout(() => {
        this._restoreButton(reconnectButton, originalButtonText);
      }, 3000);
    }).catch(error => {
      console.error('Erro ao reconectar câmera:', error);
      reconnectButton.innerHTML = '<ha-icon icon="mdi:alert"></ha-icon> Erro!';
      reconnectButton.style.backgroundColor = '#e74c3c';
      
      setTimeout(() => {
        this._restoreButton(reconnectButton, originalButtonText);
      }, 3000);
    });
  }

  _restoreButton(button, originalText) {
    button.innerHTML = originalText;
    button.disabled = false;
    button.style.backgroundColor = '#1a4b8c';
  }

  _togglePower() {
    if (!this._hass || !this.config || !this.config.power_switch) return;
    
    const switchState = this._hass.states[this.config.power_switch];
    if (!switchState) return;
    
    const service = switchState.state === 'on' ? 'turn_off' : 'turn_on';
    
    this._hass.callService('switch', service, {
      entity_id: this.config.power_switch
    });
  }

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
  description: 'Card de câmera com informações de desempenho e controles - Versão Otimizada',
  preview: true
});
