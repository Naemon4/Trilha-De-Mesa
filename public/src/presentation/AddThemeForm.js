import { h } from './dom.js';
import { icon } from './icons.js';

export function createAddThemeForm({ onSubmit }) {
  let busy = false;

  const nameInput = h('input', {
    id: 'theme-name', class: 'field__input', type: 'text', maxlength: '60',
    placeholder: 'Ex.: Tema do Lich', autocomplete: 'off',
  });
  const linkInput = h('input', {
    id: 'theme-link', class: 'field__input', type: 'text', inputmode: 'url',
    placeholder: 'Cole o link de um vídeo ou de uma playlist', autocomplete: 'off',
    'aria-describedby': 'theme-link-error',
  });
  const error = h('p', { id: 'theme-link-error', class: 'field__error', role: 'alert' });
  const submitLabel = h('span', {}, 'Adicionar tema');
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('plus'), submitLabel);

  const element = h(
    'form',
    {
      class: 'add-form',
      novalidate: true,
      onSubmit: (event) => {
        event.preventDefault();
        if (busy) return;
        setError('');
        onSubmit({ link: linkInput.value, name: nameInput.value });
      },
    },
    h('div', { class: 'field field--name' },
      h('label', { class: 'field__label', for: 'theme-name' }, 'Nome do tema (opcional)'),
      nameInput),
    h('div', { class: 'field field--link' },
      h('label', { class: 'field__label', for: 'theme-link' }, 'Link do YouTube'),
      linkInput,
      error),
    submit,
  );

  function setError(message) {
    error.textContent = message;
    if (message) linkInput.setAttribute('aria-invalid', 'true');
    else linkInput.removeAttribute('aria-invalid');
  }

  return {
    element,
    setError,
    setBusy(value) {
      busy = value;
      submit.disabled = value;
      element.setAttribute('aria-busy', String(value));
      submit.classList.toggle('is-busy', value);
      submitLabel.textContent = value ? 'Adicionando...' : 'Adicionar tema';
    },
    reset() {
      linkInput.value = '';
      nameInput.value = '';
      linkInput.focus();
    },
  };
}
