/*
  mic-btn.js — Universal voice-input mic button
  Add <script src="/mic-btn.js"></script> to any page.
  It auto-attaches a mic button next to every element matching:
    input[type=text], input[type=search], input[type=tel], input.search-input
  that has a placeholder containing "search" (case-insensitive) or
  an id containing "search".
*/
(function(){
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var supported = !!SpeechRecognition;

  function getSearchParent(input){
    var p = input.parentElement;
    if(p && p.classList.contains('input-group')) return p;
    if(p && p.tagName==='FORM'){
      var wrap = document.createElement('span');
      wrap.style.cssText = 'display:inline-flex;align-items:center;position:relative;flex:1;min-width:200px';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      return wrap;
    }
    return p;
  }

  function createMic(input){
    if(input.getAttribute('data-mic-attached')) return;
    input.setAttribute('data-mic-attached','1');

    var container = getSearchParent(input);
    if(!container) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mic-btn';
    btn.title = supported ? 'Click to speak — voice search' : 'Voice search not supported in this browser';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';

    container.style.position = 'relative';
    container.appendChild(btn);

    if(!supported){
      btn.style.opacity = '.35';
      btn.style.cursor = 'pointer';
      btn.title = 'Voice search requires HTTPS or localhost';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        alert('Voice search requires HTTPS.\nCurrent: ' + window.location.origin);
      });
      return;
    }

    var recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    var finalTranscript = '';

    recognition.onresult = function(e){
      var interim = '';
      for(var i = e.resultIndex; i < e.results.length; i++){
        if(e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = finalTranscript + interim;
      input.dispatchEvent(new Event('input', {bubbles:true}));
    };

    recognition.onend = function(){
      btn.classList.remove('recording');
      input.value = finalTranscript.trim();
      input.dispatchEvent(new Event('input', {bubbles:true}));
      finalTranscript = '';
    };

    recognition.onerror = function(){
      btn.classList.remove('recording');
      finalTranscript = '';
    };

    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if(btn.classList.contains('recording')){
        recognition.stop();
      } else {
        finalTranscript = input.value || '';
        btn.classList.add('recording');
        recognition.start();
      }
    });
  }

  function init(){
    document.querySelectorAll('input[type="text"], input[type="search"], input[type="tel"], input.search-input').forEach(function(inp){
      var ph = (inp.placeholder||'').toLowerCase();
      var id = (inp.id||'').toLowerCase();
      if(ph.indexOf('search')>=0 || id.indexOf('search')>=0){
        createMic(inp);
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.MicBtnInit = init;
})();
