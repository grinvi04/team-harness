# ── 빌드 스테이지 ─────────────────────────────────────────────────────
FROM amazoncorretto:21-al2023-jdk AS build
WORKDIR /app

COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon -q

COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test -q

# ── 런타임 스테이지 ───────────────────────────────────────────────────
FROM amazoncorretto:21-al2023-jdk-headless AS run
WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
