@e2e @partners @smoke
Feature: Partner lifecycle

    As an administrator
    I want to create and update a Partner
    So that Partner information is persisted correctly

    Scenario: Create and update a Service Partner
        Given I am logged in to the administration platform
        And I open the Partners section
        Then I should land on the Partners page
        When I create a new Service Partner using valid required data
        Then the Partner should be created successfully
        When I update the created Partner
        Then the Partner changes should be persisted
