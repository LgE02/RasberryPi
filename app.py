
from flask import Flask, render_template, request
#설치된 flask 모듈에서 Flask, render_template, request클래스를 import
app = Flask(__name__)
#Flask객체를 생성하고 app라고 명명함

app.config['SEND_FILE_MAX_AGE_DEFAULT']=0
#js코드의 생명시간을 0으로 설정, 실행때마다 새로 가져옴.

@app.route('/')
#'/'인 URL과 다음 라인에 선언된 함수를 한쌍으로 라우팅 테이블에 저장
def index():
	return render_template('index.html')
	# index.html파일을 렌더링

if __name__ == "__main__": #해당 프로그램이 독립적으로 실행될 경우
	app.run(host='0.0.0.0', port=8080, debug=True)
	#Flask 클래스의 객체, Flask 클래스의 run()함수 실행 #웹 브라우저가 어떤 서버의 어떤 IP로 접속을 요청하든 수락하고 8080포트로 웹 브라우저의 접속을 기다림. debug=True 이므로 run함수의 실행 과정을 계속 출력
