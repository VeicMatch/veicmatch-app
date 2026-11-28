'use strict';

window.criarGaleriaMatch = (() => {
  let modal;

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto) elemento.textContent = texto;
    return elemento;
  }

  function criarBotao(classe, texto) {
    const botao = criarElemento('button', classe, texto);
    botao.type = 'button';
    return botao;
  }

  function criarImagem(classe) {
    const imagem = criarElemento('img', classe);
    imagem.referrerPolicy = 'no-referrer';
    imagem.decoding = 'async';
    return imagem;
  }

  function criarModal() {
    const dialogo = criarElemento('dialog', 'match-fotos-modal');
    const titulo = criarElemento('h2', '', 'Fotos do anúncio');
    titulo.id = 'match-fotos-titulo';
    dialogo.setAttribute('aria-labelledby', titulo.id);

    const fechar = criarBotao('match-fotos-controle', 'Fechar');
    const anterior = criarBotao('match-fotos-controle', 'Anterior');
    const proxima = criarBotao('match-fotos-controle', 'Próxima');
    const contador = criarElemento('span');
    contador.setAttribute('aria-live', 'polite');
    const mensagem = criarElemento('p', 'match-fotos-erro', 'Foto indisponível.');
    mensagem.setAttribute('role', 'status');

    const cabecalho = criarElemento('header', 'match-fotos-cabecalho');
    const palco = criarElemento('div', 'match-fotos-palco');
    const controles = criarElemento('div', 'match-fotos-controles');
    cabecalho.append(titulo, fechar);
    controles.append(anterior, contador, proxima);
    dialogo.append(cabecalho, palco, controles);
    document.body.append(dialogo);

    let urls = [];
    let nome = '';
    let indice = 0;
    let origem;

    function mostrar(posicao) {
      indice = (posicao + urls.length) % urls.length;
      const imagem = criarImagem('match-fotos-ampliada');
      imagem.alt = nome + ' — foto ' + (indice + 1);
      imagem.addEventListener('error', () => {
        if (palco.firstChild === imagem) palco.replaceChildren(mensagem);
      }, { once: true });
      palco.replaceChildren(imagem);
      imagem.src = urls[indice];
      contador.textContent = (indice + 1) + ' de ' + urls.length;
      anterior.hidden = proxima.hidden = urls.length < 2;
    }

    fechar.addEventListener('click', () => dialogo.close());
    anterior.addEventListener('click', () => mostrar(indice - 1));
    proxima.addEventListener('click', () => mostrar(indice + 1));
    dialogo.addEventListener('keydown', evento => {
      if (urls.length < 2) return;
      if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
        evento.preventDefault();
        mostrar(indice + (evento.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    dialogo.addEventListener('close', () => {
      palco.replaceChildren();
      origem?.focus({ preventScroll: true });
    });

    return (fotos, carro, botao, inicial) => {
      urls = fotos;
      nome = carro;
      origem = botao;
      titulo.textContent = 'Fotos do anúncio — ' + nome;
      mostrar(inicial);
      dialogo.showModal();
      fechar.focus();
    };
  }

  return (fotos, nome, aoFalhar) => {
    if (!Array.isArray(fotos)) return null;
    const urls = [...new Set(fotos.flatMap(valor => {
      if (typeof valor !== 'string') return [];
      try {
        const url = new URL(valor.trim());
        return url.protocol === 'https:' && !url.username && !url.password ? [url.href] : [];
      } catch {
        return [];
      }
    }))].slice(0, 3);
    if (!urls.length) return null;

    const botao = criarBotao('match-fotos-capa');
    const imagem = criarImagem('match-fotos-miniatura');
    imagem.alt = '';
    imagem.loading = 'lazy';
    const rotulo = criarElemento('span', '', urls.length === 1 ? 'Ampliar foto' : 'Ver fotos (' + urls.length + ')');
    botao.setAttribute('aria-label', rotulo.textContent + ' — ' + nome);
    botao.setAttribute('aria-haspopup', 'dialog');
    botao.append(imagem, rotulo);
    let capa = 0;
    imagem.addEventListener('error', () => {
      capa++;
      if (capa < urls.length) imagem.src = urls[capa];
      else {
        imagem.remove();
        aoFalhar?.();
      }
    });
    imagem.src = urls[0];
    botao.addEventListener('click', () => {
      modal ||= criarModal();
      modal(urls, nome, botao, capa < urls.length ? capa : 0);
    });
    return botao;
  };
})();
