let ctx = null; //캔버스의 2D 컨텍스트를 저장할 변수
let chart = null; //생성된 Chart.js 차트를 저장할 변수

let config = {
	// type은 차트 종류 지정
	type: 'line', // 라인그래프
	// data는 차트에 출력될 전체 데이터 표현
	data: {
		// labels는 배열로 데이터의 레이블들
		labels: [], //x축 레이블 값
		// datasets 배열로 이 차트에 그려질 모든 데이터 셋 표현. 그래프 1개만 있음
		datasets: [{
		    label: '알콜 농도', //데이터 이름
            backgroundColor: 'blue', //데이터 배경색
            borderColor: 'rgb(255, 99, 132)', //선 테두리 색
            borderWidth: 2, //선의 두께
            data: [],  // 알콜 농도 데이터
            fill: false// 채우지 않고 그리기
        }]
    },
   // 차트의 속성 지정
	options: {
		responsive : false, // 크기 조절 금지
		scales: { // x축과 y축 정보
			xAxes: [{ //x축
				display: true, //x축 표시
				scaleLabel: { display: true, labelString: '측정 날짜/시간' },
				//레이블 표시 여부, x축의 이름
			}],
			yAxes: [{ //y축
				display: true, //y축 표시
				scaleLabel: { display: true, labelString: '알콜농도' },
				//레이블 표시 여부, y축의 이름
				//y축 눈금의 최대 최소를 지정하지 않음.
			}]
		}
	}
};

let LABEL_SIZE = 20; // 차트에 그려지는 데이터의 개수 
let tick = 0; // 도착한 데이터의 개수임, tick의 범위는 0에서 99까지만 

function drawChart() { //차트 그리기
	ctx = document.getElementById('canvas').getContext('2d'); //HTML에서 ID가 'canvas'인 요소를 가져와 2D 렌더링 컨텍스트를 생성
	chart = new Chart(ctx, config); //새차트 생성
	init(); //라벨 초기화
} 

function init() { // chart.data.labels의 크기를 LABEL_SIZE로 만들고 0~19까지 레이블 붙이기
	for(let i=0; i<LABEL_SIZE; i++) { 
		chart.data.labels[i] = ""; //빈칸으로 설정
	}
	chart.update(); //차트 업데이트
}

function addChartData(value) {
	let n = chart.data.datasets[0].data.length; // 현재 데이터의 개수 
    const currentTime = new Date().toLocaleString(); // 현재 날짜와 시간

	if(n < LABEL_SIZE){ // 현재 데이터 개수가 LABEL_SIZE보다 작은 경우
		chart.data.datasets[0].data.push(value);
    }
	else { // 현재 데이터 개수가 LABEL_SIZE를 넘어서는 경우
		// 새 데이터 value 삽입
		chart.data.datasets[0].data.push(value); // value를 data[]의 맨 끝에 추가
		chart.data.datasets[0].data.shift(); // data[]의 맨 앞에 있는 데이터 제거
	}

    chart.data.labels.unshift(currentTime); //새로운 날짜/시간 레이블을 맨 앞에 추가
    if (chart.data.labels.length > LABEL_SIZE) {  //LABEL_SIZE보다 차트 라벨 개수가 크면
        chart.data.labels.pop();  //마지막 레이블 제거
    }
    
	tick++; // 도착한 데이터의 개수 증가
	tick %= 100; // tick의 범위는 0에서 99까지만. 100보다 크면 다시 0부터 시작
	chart.update(); //차트 업데이트
    
}

