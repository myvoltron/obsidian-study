Created at:  2025-01-15 14:41
Tag: #backend #architecture
References:
Link Notes: 

# Entity
- Entity는 DB의 테이블에 존재하는 Column들을 필드로 가지는 객체를 말한다. 따라서 DB의 테이블과 1:1로 매칭된다고 생각하면 된다.
- 데이터의 저장과 조회가 목적이다.

다음과 같은 예시를 들자면,
```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;
}
```
해당 User Entity Class는 DB의 users와 직결되는 예로 생각할 수 있다.

# DTO
- DTO는 Data Transfer Object의 약자로, 계층 간 데이터 교환 역할을 한다. JSON serialization과 같은 직렬화에도 쓰인다.
- 보통은 API의 요청(Request) 또는 응답(Response) 데이터 형식을 정의할 때 쓴다.
- Entity를 그대로 노출하는 건 데이터베이스 테이블을 그대로 노출하는 거라 보안상 좋지 않다. 따라서 DTO를 통해서 필요한 데이터만 필터링 해 노출할 수 있다.

다음과 같은 예시를 들 수 있다.
```typescript
export class CreateUserDto {
  name: string;
  email: string;
  password: string;
}
```
