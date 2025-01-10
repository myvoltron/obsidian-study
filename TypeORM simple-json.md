#nestjs #typeorm 

typeorm에서는 간편하게 json을 저장할 수 있도록 simple-json을 지원한다. json 객체를 문자열로 변환 후 DB에 저장하는 방식이다. 
기본적으로 TEXT 타입으로 설정되기 때문에 rows가 많으면 쓸 데 없는 용량 차지가 많을 수도 있으므로 잘 생각해서 쓰는게 좋아보인다.