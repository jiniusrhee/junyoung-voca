# 우리 앱 리스닝(키보드 모드)에서 지금 문장을 자판으로 친다: lans.sh [남길 글자 수]
S="C:/Users/user/AppData/Local/Temp/claude/5dc5b5acd84862b9/8a6699d3-73eb-4e73-b24e-84003fe616b1/scratchpad"; source "$S/tools/w.sh"
t=$(oev "document.querySelector('.card-slide:not(.exit) .lq-en').textContent.toLowerCase().replace(/[^a-z ]/g,'')")
echo "sentence: $t"
keep=${1:-0}
if [ "$keep" -gt 0 ]; then t="${t:0:$((${#t}-keep))}"; fi
python -I "$S/tools/kb.py" "$t" --gap 0.1
