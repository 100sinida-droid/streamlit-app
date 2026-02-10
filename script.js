(adsbygoogle = window.adsbygoogle || []).push({});

function calc() {

    let buy = parseFloat(document.getElementById("buyPrice").value);
    let qty = parseFloat(document.getElementById("qty").value);
    let current = parseFloat(document.getElementById("currentPrice").value);

    if(!buy || !qty || !current){
        alert("값을 입력하세요");
        return;
    }

    let total = buy * qty;
    let now = current * qty;

    let profit = now - total;
    let rate = (profit / total * 100).toFixed(2);

    document.getElementById("result").innerHTML =
        `총 투자금: ${total.toLocaleString()}원<br>
         현재 평가금: ${now.toLocaleString()}원<br>
         손익: ${profit.toLocaleString()}원 (${rate}%)`;
}
