/* === Quiz Widget === */
/* Reusable across all lessons. Usage:
   <div class="quiz" id="quiz-1" data-correct="1">
     <h3>Quick Check</h3>
     <p class="question">Question text here?</p>
     <span class="option" data-idx="0">Option A</span>
     <span class="option" data-idx="1">Option B</span>
     <span class="option" data-idx="2">Option C</span>
     <span class="option" data-idx="3">Option D</span>
     <div class="feedback"></div>
   </div>
   <script src="../assets/quiz.js"></script>
*/
(function() {
  document.querySelectorAll('.quiz').forEach(quiz => {
    const correct = parseInt(quiz.dataset.correct);
    const options = quiz.querySelectorAll('.option');
    let answered = false;

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const chosen = parseInt(opt.dataset.idx);
        const fb = quiz.querySelector('.feedback');

        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        if (chosen === correct) {
          fb.textContent = '✓ Correct!';
          fb.className = 'feedback show correct';
        } else {
          fb.textContent = '✗ Not quite. The correct answer is highlighted.';
          fb.className = 'feedback show incorrect';
          options[correct].style.borderColor = '#2e7d32';
          options[correct].style.background = '#e8f5e9';
        }
      });
    });
  });
})();
