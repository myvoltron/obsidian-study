Created at:  2025-01-12 17:02
Tag: #oop #cs
References:
- [https://en.wikipedia.org/wiki/Object_(computer_science)](https://en.wikipedia.org/wiki/Object_(computer_science))
Link Notes:

# 1. 객체란?
객체 지향 프로그래밍에서 객체가 뜻하는건 무엇일까요?
- 보통 객체지향에서 객체는 변수, 함수, 데이터 구조의 혼합을 뜻합니다. C언어의 Structure에서 메서드가 추가되었다고 생각하면 편합니다. (엄밀히 따지면 더 복잡하지만)
- 특히 Class 기반의 객체 지향 프로그래밍 언어에서 Class에 의해 생성된 Instance를 나타냅니다.
## 1.1 객체지향프로그래밍이란?
그러면 객체 지향 프로그래밍은 또 뭘까요?
- OOP는 현실세계의 객체들을 모델링하고 그런 객체들끼리 상호작용하는 프로그램을 개발하는 패러다임입니다.
- 객체들의 상태와 행동을 캡슐화해서 코드의 재사용성, 유지보수성, 확장성을 높이는 걸 목적으로 합니다.
- 따라서, 객체 지향 프로그래밍은 객체들을 중심으로 코드를 구성하여 높은 추상화 수준을 제공하고 코드의 구조화와 관리를 용이하게 합니다.
# 2. 객체지향의 특징
## 2.1 추상화 (Abstraction)
- [네이버 지식백과에서 설명하는 추상화](https://terms.naver.com/entry.naver?docId=3607505&cid=58598&categoryId=59316)
- 객체지향프로그래밍에서 추상화는 복잡한 현실 세계의 개념을 단순화하고 모델링하는 것을 의미합니다.
- 즉, 객체들의 공통된 속성과 행동을 추출해 상위 개념을 정의하고, 이를 기반으로 하위 개념들을 생성하는 과정입니다.

다음은 타입스크립트에서 추상화를 구현한 예제입니다.
```tsx
interface Vehicle {
  speed: number;
  move(): void;
}

class Car implements Vehicle {
  speed: number;
  constructor(speed: number) {
	this.speed = speed;
  }
  move(): void {
	console.log("The car is moving at " + this.speed + " km/h.");
  }
}

class Bicycle implements Vehicle {
  speed: number;
  constructor(speed: number) {
	this.speed = speed;
  }
  move(): void {
	console.log("The bicycle is moving at " + this.speed + " km/h.");
  }
}

const car = new Car(100);
const bicycle = new Bicycle(20);

car.move(); // The car is moving at 100 km/h.
bicycle.move(); // The bicycle is moving at 20 km/h.
```
위 예시에서 `Vehicle`이라는 인터페이스를 선언하고, `Car` 클래스와 `Bicycle` 클래스가 이를 구현하고 있습니다. `Vehicle` 인터페이스는 `speed` 속성과 `move` 메서드를 정의하고 있으며, 이 두 속성과 메서드는 `Car` 클래스와 `Bicycle` 클래스에서 모두 구현되고 있습니다.

이처럼 인터페이스를 통해 공통된 속성과 행동을 추상화하고, 이를 구현한 클래스들에서 공통된 코드를 재사용함으로써, 소프트웨어의 유지보수성과 확장성을 높일 수 있습니다.
## 2.2 상속 (Inheritance)
- 객체 지향 프로그래밍에서 상속은 부모 클래스가 가지고 있는 속성과 메서드를 자식 클래스에서 물려받아 사용할 수 있는 개념입니다.
- 자식 클래스는 부모 클래스의 기능을 그대로 상속받을 뿐 아니라, 필요에 따라 새로운 속성과 메서드를 추가하거나, 부모 클래스의 기능을 재정의할 수도 있습니다.
- 상속은 클래스 간의 계층 구조를 만들어 코드의 재사용성을 높이고, 클래스 간의 관계를 명확하게 해줍니다.

다음은 타입스크립트에서 추상화를 구현한 예제입니다.
```tsx
class Vehicle {
  speed: number;
  constructor(speed: number) {
	this.speed = speed;
  }
  move(): void {
	console.log("The vehicle is moving at " + this.speed + " km/h.");
  }
}

class Car extends Vehicle {
  constructor(speed: number) {
	super(speed);
  }
}

class Bicycle extends Vehicle {
  constructor(speed: number) {
	super(speed);
  }
  move(): void {
	console.log("The bicycle is moving at " + this.speed + " km/h.");
  }
}

const car = new Car(100);
const bicycle = new Bicycle(20);

car.move(); // The vehicle is moving at 100 km/h.
bicycle.move(); // The bicycle is moving at 20 km/h.
```
`Car` 클래스와 `Bicycle` 클래스 모두 공통적인 특성을 가지고 있습니다. 속도나 움직이는 행동이 있습니다. 따라서 `Vehicle` 클래스를 정의해서 `speed`라는 속성을 정의하고 `move`라는 메서드를 정의했습니다. 그리고 `Car`와 `Bicycle` 클래스가 상속을 받도록 해서 중복되는 특성을 편하게 받을 수 있도록 했습니다.
## 2.3 다형성 (Polymorphism)
- 객체 지향 프로그래밍에서 다형성(Polymorphism)은 같은 이름의 메서드나 연산자가 다른 클래스의 인스턴스에서 다르게 동작하는 능력을 말합니다.
- 즉, 하나의 인터페이스나 추상 클래스를 여러 클래스가 구현하고, 이를 사용하는 코드에서는 여러 클래스의 객체를 동일한 타입으로 처리할 수 있는 능력입니다.

다형성을 이용하면, 코드의 재사용성과 확장성을 높일 수 있습니다. 예를 들어, 다양한 도형(원, 삼각형, 사각형 등)이 있을 때, 각 도형의 면적을 계산하는 메서드를 구현할 때, 다형성을 이용하면 여러 도형 클래스에서 이 메서드를 구현할 수 있습니다. 이렇게 하면, 코드의 재사용성이 높아지며, 새로운 도형 클래스를 추가해도 기존 코드의 수정이 필요 없습니다.

타입스크립트에서는 인터페이스나 추상 클래스를 이용하여 다형성을 구현할 수 있습니다. 
다음은 타입스크립트에서 추상화를 구현한 예제입니다.
```tsx
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  width: number;
  height: number;
  constructor(width: number, height: number) {
	this.width = width;
	this.height = height;
  }
  getArea(): number {
	return this.width * this.height;
  }
}

class Circle implements Shape {
  radius: number;

  constructor(radius: number) {
	this.radius = radius;
  }

  getArea(): number {
	return Math.PI * this.radius * this.radius;
  }
}

function printArea(shape: Shape): void {
  console.log("The area is " + shape.getArea());
}

const rectangle = new Rectangle(10, 20);
const circle = new Circle(5);

printArea(rectangle); // The area is 200
printArea(circle); // The area is 78.53981633974483
```

위 코드에서는 `Shape` 인터페이스를 정의하고, `Rectangle` 클래스와 `Circle` 클래스가 이를 구현하고 있습니다. 이 때, 각 클래스에서는 `getArea` 메서드를 구현하고 있습니다. `printArea` 함수는 `Shape` 타입을 매개변수로 받으며, 이를 구현한 `Rectangle` 클래스와 `Circle` 클래스의 인스턴스를 모두 전달할 수 있습니다. 이렇게 하면, `printArea` 함수에서는 각 도형 클래스에서 구현한 `getArea` 메서드가 동일한 이름으로 호출되며, 다형성이 구현됩니다. 
## 2.4 캡슐화 (Encapsulation)
- 객체 지향 프로그래밍에서 캡슐화(Encapsulation)란, 데이터와 데이터를 처리하는 메서드를 하나의 묶음으로 묶는 것을 말합니다.
- 이를 통해, 데이터에 직접 접근하는 것을 제한하고, 데이터와 메서드를 함께 캡슐화된 객체의 인터페이스를 통해 사용하도록 하는 것입니다.

캡슐화를 이용하면, 객체의 내부 구현을 외부로부터 숨길 수 있어 정보은닉(Information Hiding)이 가능해집니다. 이를 통해, 객체 간의 상호작용이 명확하게 정의될 수 있으며, 객체의 내부 구현이 변경되더라도 외부에서 영향을 받지 않도록 할 수 있습니다.

타입스크립트에서는 클래스를 이용하여 캡슐화를 구현할 수 있습니다. 클래스의 속성에는 접근 제어자(Access Modifier)를 이용하여 외부에서의 접근을 제어할 수 있습니다. 
다음은 타입스크립트에서 추상화를 구현한 예제입니다.
```tsx
class BankAccount {
  private balance: number;

  constructor(initialBalance: number) {
	this.balance = initialBalance;
  }

  public deposit(amount: number): void {
	this.balance += amount;
  }

  public withdraw(amount: number): void {
	if (amount <= this.balance) {
	  this.balance -= amount;
	} else {
	  console.log("Insufficient balance");
	}
  }

  public getBalance(): number {
	return this.balance;
  }
}

const account = new BankAccount(1000);
console.log(account.getBalance()); // 1000

account.deposit(500);
console.log(account.getBalance()); // 1500

account.withdraw(1000);
console.log(account.getBalance()); // 500

// Cannot access 'balance' because it is private.
// account.balance = 2000;
```

위 코드에서는 `BankAccount` 클래스가 정의되어 있습니다. 이 클래스에는 `balance` 속성이 private 접근 제어자로 선언되어 있습니다. 이렇게 하면, `balance` 속성에는 클래스 외부에서 직접 접근할 수 없습니다. 대신에, `deposit`, `withdraw`, `getBalance` 메서드를 이용하여 `balance` 속성에 간접적으로 접근할 수 있습니다. 이렇게 하면, `balance` 속성의 값을 클래스 외부에서 보호할 수 있습니다.

