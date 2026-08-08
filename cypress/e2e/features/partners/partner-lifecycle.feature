@e2e @partners @smoke
Feature: Partner management

    Background:
        Given I am logged in to the administration platform
        And I open the Partners section
        Then I should land on the Partners page

    Scenario: Create a Service Partner
        When I create a new Service Partner using valid required data
        Then the Partner should be created successfully

    Scenario: Update a Service Partner
        When I create a new Service Partner using valid required data
        Then the Partner should be created successfully
        When I update the created Partner
        Then the Partner changes should be persisted
