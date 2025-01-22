let client = null; // MQTT 클라이언트의 역할을 하는 Client 객체를 가리키는 전역변수
let connectionFlag = false; // 연결 상태이면 true
const CLIENT_ID = "client-" + Math.floor((1 + Math.random()) * 0x10000000000).toString(16) // 사용자 ID 랜덤 생성

// 브레이크와 알콜 기록을 저장할 배열
let brakeRecords = [];
let alcoholRecords = [];

//페이지 표시 함수
function showPage(pageId) {
    //모든 페이지 요소를 숨김
    const pages = document.querySelectorAll('.page'); //'.page' 클래스를 가진 모든 요소를 선택
    pages.forEach(page => page.style.display = 'none');  //각 페이지의 display 속성을 'none'으로 설정

    const selectedPage = document.getElementById(pageId); //선택한 페이지만 표시
    if (selectedPage) { //요소가 존재할 경우
        selectedPage.style.display = 'block'; //해당 페이지의 display 속성을 'block'으로 설정
    }
}

// 페이지가 로드될 때 로컬 스토리지에서 기록을 불러오는 함수
window.onload = function() {
    showPage('carManagement'); //carManagement 페이지를 기본으로 보여줌
    const savedRecords = localStorage.getItem("brakeRecord"); //로컬 스토리지에서 "brakeRecord"키 값을 가져옴
    if (savedRecords) {
        brakeRecords = JSON.parse(savedRecords); //JSON 형식의 데이터를 자바스크립트 객체로 변환
        brakeRecords.forEach(record => { //brakeRecords 배열에 있는 각 기록(메시지, 날짜)을 화면에 추가
            addBrakeRecord(record.message, record.time);
        });
    }

    alcoholRecords = loadAlcoholRecords(); // 로컬 스토리지에서 알콜 기록 가져오기
    updateAT(); // 알콜 테이블 업데이트
};

function connect() { //브로커에 접속하는 함수
    if (connectionFlag == true)
        return; // 현재 연결 상태이므로 다시 연결하지 않음
    // 사용자가 입력한 브로커의 IP 주소와 포트 번호 알아내기
    let broker = document.getElementById("broker").value; // 브로커의 IP 주소
    let port = 9001 // mosquitto를 웹소켓으로 접속할 포트 번호

    // MQTT 메시지 전송 기능을 모두 가징 Paho client 객체 생성
    client = new Paho.MQTT.Client(broker, Number(port), CLIENT_ID);

    // client 객체에 콜백 함수 등록 및 연결
    client.onConnectionLost = onConnectionLost; // 접속 끊김 시 onConnectLost() 실행 
    client.onMessageArrived = onMessageArrived; // 메시지 도착 시 onMessageArrived() 실행

    // client 객체에게 브로커에 접속 지시
    client.connect({
        onSuccess: onConnect, // 브로커로부터 접속 응답 시 onConnect() 실행
    });
}

//브로커로의 접속이 성공할 때 호출되는 함수
function onConnect() {
    document.getElementById("line").innerHTML += '<br><span><h4>연결성공</h4>' + '</span>';
    connectionFlag = true; // 연결 상태로 설정
    subscribe('brake'); //brake 토픽 구독
    subscribe('alcohol'); //alcohol 토픽 구독
}
//구독 요청이 들어왔을떄 호출되는 함수
function subscribe(topic) {
    if (connectionFlag != true) { // 연결되지 않은 경우
        alert("연결되지 않았음");
        //return false;
    }
    client.subscribe(topic); // 브로커에 구독 신청
    //return true;
}
//publish 요청이 들어왔을때 호출되는 함수
function publish(topic, msg) {
    if (connectionFlag != true) { // 연결되지 않은 경우
        alert("연결되지 않았음");
        //return false;
    }
    client.send(topic, msg, 0, false); //브로커에게 메시지 보내기
    //return true;
}

function unsubscribe(topic) {
    if (connectionFlag != true) return; // 연결되지 않은 경우
    client.unsubscribe(topic, null); // 브로커에 구독 신청 취소
}

// 접속이 끊어졌을 때 호출되는 함수
function onConnectionLost(responseObject) { // responseObject는 응답 패킷
    if (responseObject.errorCode !== 0) {
    }
    connectionFlag = false; // 연결 되지 않은 상태로 설정
}

// 메시지가 도착할 때 호출되는 함수
function onMessageArrived(message) { // 매개변수 msg는 도착한 MQTT 메시지를 담고 있는 객체
    const topic = message.destinationName; //메시지의 토픽만 가져오기
    const payload = message.payloadString; //메시지의 메시지만 가져오기

    if (topic === 'alcohol') { //토픽이 'alcohol'일떄
        const alcoholValue = parseFloat(payload); // 수신된 값을 숫자로 변환
        const alcoholPercentage = convertToPercentage(alcoholValue); // 알콜 값 퍼센트로 변환
        const alcoholTime = new Date().toLocaleString(); // 현재 날짜와 시간

        addChartData(alcoholPercentage, alcoholTime); //표에 전달
        document.getElementById("alert").innerHTML = `<span>현재 알코올 농도 수치 : ${alcoholPercentage}%</span><br/>`;
        //현재 알코올 농도 수치를 alert ID에 출력

        if (alcoholValue >= 300){ //측정된 알코올값이 300이상이면
            alcoholRecords.push({ percentage: alcoholPercentage, time: new Date().toLocaleString() });
            //알콜 기록을 저장하는 배열에 알코올 퍼센트값과 토픽을 받은 시간을 저장
            saveAlcoholRecords(); // 로컬 스토리지에 기록 저장
            updateAT(); // 기록된 알콜 농도를 테이블로 업데이트
            alert("알콜 농도 수치 초과");//측정된 알코올값이 300이상이면 출력
        }
        else{
            alert("시동중..."); //측정된 알코올값이 300미만이면 출력
        }
    }
    else if (topic === 'brake') { //토픽이 'brake'일떄
        BrakeMessage(payload); //브레이크 메시지를 관리하는 함수 불러오기
    } 
}
// 알콜 값이 300일 때 0.03%을 기준으로
function convertToPercentage(alcoholValue) {
    return (alcoholValue / 300) * 0.03; //알코올 값을 퍼센트로 변환
}

// 알콜 기록을 로컬 스토리지에 저장하는 함수
function saveAlcoholRecords() {
    localStorage.setItem("alcoholRecords", JSON.stringify(alcoholRecords)); 
    //'alcoholRecords'를 키값으로 데이터를 JSON.stringify()를 사용하여 자바스크립트 배열을 JSON 문자열로 변환하여 로컬 스토리지에 알코올 측정 기록 저장
}

//로컬 스토리지에서 알콜 기록을 가져오는 함수
function loadAlcoholRecords() {
    const storedRecords = localStorage.getItem("alcoholRecords"); //로컬 스토리지에서 'alcoholRecords'를 키값으로 데이터 가져오기
    if (storedRecords) {
        return JSON.parse(storedRecords); //로컬 스토리지에서 저장된 기록을 가져와 배열로 변환
    }
    return []; // 기록이 없으면 빈 배열 반환
}

//알콜 테이블 업데이트하는 함수
function updateAT(){
    const table = document.getElementById("alcoholTable"); //테이블을 가져오기
    const tbody = table.getElementsByTagName("tbody")[0]; //테이블의 tbody 가져오기
    tbody.innerHTML = ""; //기존의 테이블 내용 삭제

    //alcoholRecords 배열을 순회하여 알콜 농도 기록을 테이블에 추가
    alcoholRecords.forEach((record, index) => {
        const row = tbody.insertRow(); // 새 행 추가

        const cellIndex = row.insertCell(0); //인덱스 번호 셀 0번
        cellIndex.innerHTML = index + 1; // 1부터 시작하는 인덱스 번호

        const cellTime = row.insertCell(1); //시간 셀 1번
        cellTime.innerHTML = record.time; //시간 넣기

        const cellPercentage = row.insertCell(2); //농도 셀 2번
        cellPercentage.innerHTML = `${record.percentage}%`; //농도 넣기
    });

}
// 브레이크 메시지 처리 함수
function BrakeMessage(msg) {
    const brakeTime = new Date().toLocaleString(); //현재 날짜와 시간
    brakeRecords.push({ message: msg, time: brakeTime }); //배열에 새로운 브레이크 기록 추가
    addBrakeRecord(msg, brakeTime); //테이블에 추가

    localStorage.setItem("brakeRecord", JSON.stringify(brakeRecords));
    //'brakeRecord'를 키값으로 데이터를 JSON.stringify()를 사용하여 자바스크립트 배열을 JSON 문자열로 변환하여 로컬 스토리지에 브레이크 기록 저장
}

// 테이블에 브레이크 기록을 추가하는 함수
function addBrakeRecord(msg, brakeTime) {
    const tableBody = document.getElementById("brakeRecordsBody"); //테이블을 가져오기

    // 테이블이 잘 선택되었는지 확인
    if (!tableBody) {
        console.error("테이블 바디를 찾을 수 없습니다.");
        return;
    }

    // 새로운 행 추가
    const row = tableBody.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);

    // 셀에 데이터 삽입
    cell1.textContent = msg;
    cell2.textContent = brakeTime;
}

// disconnection 버튼이 선택되었을 때 호출되는 함수
function disconnect() {
    if (connectionFlag == false)
        return; // 연결 되지 않은 상태이면 그냥 리턴
    GPIO.cleanup() //사용한 모든 핀을 기억에서 제거
    client.disconnect(); // 브로커와 접속 해제
    connectionFlag = false; // 연결 되지 않은 상태로 설정
}