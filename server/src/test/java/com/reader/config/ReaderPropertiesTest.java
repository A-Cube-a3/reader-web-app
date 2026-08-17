package com.reader.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class ReaderPropertiesTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesConfiguration.class);

    @Test
    void bindsStorageAndCorsConfiguration() {
        contextRunner
                .withPropertyValues(
                        "reader.storage.path=./test-storage",
                        "reader.cors.allowed-origins[0]=https://reader.example.com",
                        "reader.cors.allowed-origins[1]=https://preview.example.com"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    ReaderProperties properties = context.getBean(ReaderProperties.class);
                    assertThat(properties.storage().path()).isEqualTo(Path.of("test-storage"));
                    assertThat(properties.cors().allowedOrigins()).containsExactly(
                            "https://reader.example.com",
                            "https://preview.example.com"
                    );
                });
    }

    @Test
    void failsWhenRequiredCorsOriginsAreMissing() {
        contextRunner
                .withPropertyValues("reader.storage.path=./test-storage")
                .run(context -> assertThat(context).hasFailed());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(ReaderProperties.class)
    static class PropertiesConfiguration {
    }
}
