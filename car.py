import RPi.GPIO as GPIO
import time
import Adafruit_MCP3008
import paho.mqtt.client as mqtt
from datetime import datetime

broker_ip="localhost" #브로커 아이디 설정

#MQTT 클라이언트 객체 생성
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)  
client.connect(broker_ip, 1883) #브로커에 접속
client.loop_start() #메시지 루프를 실행하는 스레드 시작


#MCP3008 초기화
mcp = Adafruit_MCP3008.MCP3008(clk=11, cs=8, miso=9, mosi=10)

#핀 번호 설정
ENA = 13 #PWM 핀
IN1 = 6 #정방향 제어 핀
IN2 = 5 #역방향 제어 핀
alcolBut = 12 #알콜 측정 버튼
BrackBut = 18 #브레이크 버튼
LED = 27 #LED 제어 핀
TRIG = 20 #초음파 센서 Trig 핀
ECHO = 16 #초음파 센서 Echo 핀

#GPIO 초기화
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(ENA, GPIO.OUT)
GPIO.setup(IN1, GPIO.LOW)
GPIO.setup(IN2, GPIO.LOW)
GPIO.setup(alcolBut, GPIO.IN, pull_up_down=GPIO.PUD_DOWN) #알콜측정 버튼 풀다운 설정
GPIO.setup(BrackBut, GPIO.IN, pull_up_down=GPIO.PUD_DOWN) #브레이크 측정 버튼 풀다운 설정
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)
GPIO.setup(LED, GPIO.OUT)

GPIO.output(LED, GPIO.LOW) #LED 초기 상태를 끄도록 설정

#PWM 설정
pwm = GPIO.PWM(ENA, 100) #PWM 주파수 100Hz
pwm.start(0) #초기 듀티 사이클 0

#변수 초기화
motor_speed = 0 #현재 모터 속도
alcohol_threshold = 300 #알콜 농도 기준값
light_threshold = 250 #조도 센서 기준값
brake_status = False #현재 브레이크 버튼 상태
obstacle_status = False #현재 장애물 유무 상태 
alcohol_measured = False #현재 알콜이 측정되었는지 여부
run = False #현재 작동 여부

def stop_motor(): #모터가 멈추는 함수
    global motor_speed #현재 모터 속도
    GPIO.output(IN1, GPIO.LOW) #바퀴 정방향 이동 멈추기
    GPIO.output(IN2, GPIO.LOW) #바퀴 역방향 이동 멈추기
    pwm.ChangeDutyCycle(0) #듀티 사이클 0%
    motor_speed = 0 #현재 모터 속도 0 설정


def start_motor(speed=50): #모터가 움직이기 시작하는 함수
    global motor_speed #현재 모터 속도
    GPIO.output(IN1, GPIO.HIGH) #바퀴 정방향으로 작동
    GPIO.output(IN2, GPIO.LOW) #바퀴 역방향 이동 멈추기
    pwm.ChangeDutyCycle(speed) #듀티 사이클 50%
    start=50
    for speed in range(start, 100 + 1, 10): #50부터 10씩 100까지 더하기
        pwm.ChangeDutyCycle(speed) #반뀌는 값을 듀티사이클로 설정
        print(f"모터 속도 증가: {speed}%")
        time.sleep(0.5)  # 0.5초 간격으로 속도 증가
    motor_speed = speed #현재 모터 속도에 speed 100을 저장


def measureDistance(trig, echo): #거리 측정
	time.sleep(0.2) #초음파 센서의 준비 시간을 위해 필연적인 200밀리초 지연
	GPIO.output(trig, 1) #trig 핀에 1(High) 출력
	GPIO.output(trig, 0) #trig 핀 신호 High->Low. 초음사 발사 지시
	
	while(GPIO.input(echo) == 0): #echo 핀 값이 0->1로 바뀔 때까지 루프
		pass

	#echo 핀 값이 1이면 초음파가 발사되었음
	pulse_start = time.time() #초음파 발사 시간 기록
	while(GPIO.input(echo) == 1): #echo 핀 값이 1->0으로 바뀔 때까지 루프
		pass

	#echo 핀 값이 0이 되면 초음파 수신하였음
	pulse_end = time.time() #초음파가 되돌아 온 시간 기록
	pulse_duration = pulse_end - pulse_start #경과 시간 계산
	return pulse_duration*340*100/2 #거리 계산하여 리턴(단위 cm)


def brake_control(): #브레이크 버튼 제어
    global brake_status #현재 브레이크 상태 가져오기
    if GPIO.input(BrackBut) == GPIO.HIGH:  # 버튼 눌림 상태
        if not brake_status:  # 브레이크 버튼이 처음 눌렸을 때만 모터 정지
            print("브레이크 버튼 눌림: 모터 정지 중...")
            stop_motor() #모터 작동 멈추기
            brake_status = True #브레이크가 작동된 상태로 업데이트 
            client.publish("brake", "브레이크 작동")  # MQTT로 'brake'토픽으로 브레이크 작동 전송
    else:
        if brake_status:  # 버튼을 떼었을 때만 모터 재작동
            print("브레이크 버튼 해제: 모터 재작동")
            start_motor() #모터 작동
            brake_status = False #브레이크의 정지 상태로 업데이트 


def obstacle_control(): #장애물 감지 및 모터 제어
    global motor_speed, obstacle_status #현재 모터속도, 장애물 감지 상태 가져옴
    distance = measureDistance(TRIG, ECHO) #장애물까지와의 거리
    if distance <= 15: #거리가 15cm이하면
        print(f"장애물 감지! 거리: {distance:.2f}cm - 모터 정지")
        stop_motor() #모터 멈추기
        obstacle_status = True  #장애물이 감지된 상태로 설정
    else:
        if obstacle_status: #거리가 15cm초과면
            print(f"장애물 제거됨! 거리: {distance:.2f}cm - 모터 재작동")
            start_motor()#모터 작동
            obstacle_status = False  #장애물이 제거된 상태로 설정



def light_control(): #LED 제어
    light_value = mcp.read_adc(0)  #MCP3008 채널 0 값 가져오기
    if light_value < light_threshold: #조도값이 250보다 적다면
        GPIO.output(LED, GPIO.HIGH) #라이트 출력
        #print("조도 낮음: 라이트 켜짐")
    else: #조도값이 250이상이면
        GPIO.output(LED, GPIO.LOW) #라이크 꺼짐
        #print("조도 충분: 라이트 꺼짐")


# 메인 루프
try:
    #print("시스템 시작: 알코올 측정 대기 중...")

    while True: #무한 반복 진행
        if GPIO.input(alcolBut) == GPIO.HIGH: #알콜 측정 버튼이 눌린 상태일시
            alcohol_value = mcp.read_adc(1)  # MCP3008 채널 1 값을 출력
            print(f"알코올 센서 값: {alcohol_value}")
            if alcohol_value >= alcohol_threshold: #측정한 알콜값이 300이상이면
                print("알코올 농도 초과: 모터 작동 불가")
                client.publish("alcohol",alcohol_value) #MQTT로 'alcohol'토픽으로 측정된 알콜값 전송
                stop_motor() #모터멈추기

            else: #측정된 알콜값이 300미만이면
                print("알코올 농도 정상: 모터 작동 가능")
                client.publish("alcohol",alcohol_value) #MQTT로 'alcohol'토픽으로 측정된 알콜값 전송
                start_motor()  # 기본 모터 작동 시작
                run = True #모터 작동가능 상태로 변환
                
            alcohol_measured = True  #측정중인 상태로 변환 -> 버튼 한번에 한번만 측정하도록 함.
        else:  #알콜 측정 버튼이 떼어진 경우
            alcohol_measured = False  # 버튼이 떼어지면 다시 측정 가능상태로 변환

        if run:  #알콜이 측정되고 측정값이 300미만일시 다른 장치들의 동작 시작
            brake_control() #브레이크 제어함수
            obstacle_control() #장애물 감지함수
            light_control() #라이트 제어함수
        time.sleep(0.1)  # CPU 과부하 방지

except KeyboardInterrupt: #Ctrl + C로 종료시
	print("시스템 종료")

finally: #프로그램을 어떻게 멈추든 항상 실행
    pwm.stop() #PWM 신호 출력을 중지
    client.loop_stop() #메시지 루프를 실행하는 스레드 종료 
    client.disconnect() #MQTT연결 끊기
    GPIO.cleanup() #사용한 모든 핀을 기억에서 제거


